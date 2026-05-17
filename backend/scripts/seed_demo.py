"""Populate the database with credible Bolivia-context demo data.

Seed data is tagged by the ``@seed.truevalue.local`` email domain. Re-running
the script wipes only tagged rows (and their properties / sales) before
re-inserting, so real users and any data they own are untouched.

Run from the ``backend/`` directory::

    uv run python -m scripts.seed_demo                                # defaults
    uv run python -m scripts.seed_demo --agents 50 --properties 1000 --sales 3000
    uv run python -m scripts.seed_demo --leads 200                    # bump lead count
    uv run python -m scripts.seed_demo --rng-seed 42                  # reproducible

Defaults: 25 agents, 200 properties, 500 sales, 80 leads. Also creates /
refreshes a demo admin (``seed_admin`` / ``seed-demo-1234``) so a fresh
environment is immediately usable.

Sales mix: ~90% are property-linked (Comisión venta/alquiler, anticrético,
depósito, administración) and ~10% are standalone services (notaría,
asesoría, fotografía, tasación, etc.).
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
import unicodedata
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from faker import Faker

from app.seed.bolivia_data import (
    AMENITIES_POOL,
    APELLIDOS,
    GAS_NATURAL_PROB_BY_CITY,
    HIGH_VALUE_PAYMENTS,
    LEAD_AREA_MIN_CHOICES,
    LEAD_BEDROOMS_MIN_CHOICES,
    LEAD_EMAIL_DOMAINS,
    LEAD_MUST_HAVES,
    LEAD_NOTES_TEMPLATES,
    LEAD_SOURCES_WEIGHTED,
    LEAD_STATUSES_WEIGHTED,
    LEGAL_STATUSES_WEIGHTED,
    LINKED_SALES_TEMPLATES,
    LISTING_TYPES_WEIGHTED,
    OFFICE_HOURS_END,
    OFFICE_HOURS_START,
    OFFICE_WEEKDAYS,
    PRESENCE_WEIGHTED,
    PRICE_RANGES_USD,
    PROPERTY_FEATURES,
    PROPERTY_TYPES,
    SALE_PROPERTY_TYPES,
    SENSOR_ROOMS,
    SERVICE_PAYMENTS,
    STANDALONE_SALES_TEMPLATES,
    UTILITIES_BASE,
    UTILITIES_EXTRA,
    VISITOR_ENTRANCE_ROOM,
    VISITOR_INTERIOR_ROOMS,
    ZONES_BY_CITY,
)
from app.tables.leads import Lead
from app.tables.measurements import Measurement
from app.tables.properties import Property
from app.tables.sales import Sale
from app.tables.users import User
from app.tables.visitor_events import VisitorEvent

SEED_EMAIL_DOMAIN = "seed.truevalue.local"
SEED_PASSWORD = "seed-demo-1234"  # documented; only set on seed_* accounts
DEMO_ADMIN_USERNAME = "seed_admin"

DEFAULT_AGENTS = 25
DEFAULT_PROPERTIES = 200
DEFAULT_SALES = 500
DEFAULT_LEADS = 80

DEFAULT_MEASUREMENT_DAYS = 2
DEFAULT_MEASUREMENT_SENSOR_FRAC = 0.5
DEFAULT_OPEN_HOUSE_FRAC = 0.3

# Date-range windows (days back from "now"). Business records (properties,
# sales) span a year so timeline charts look credible. Leads stay recent
# (90 d) because older pipeline rows would normally be closed or lost in
# real CRM use. Edge windows live in their own seeder functions.
PROPERTIES_DAYS_BACK = 365
SALES_DAYS_BACK = 365
LEADS_DAYS_BACK = 90

# Fraction of sales drawn from STANDALONE_SALES_TEMPLATES (services like
# notaría, asesoría, fotografía that aren't tied to a specific property).
# Per-sale Bernoulli draw — converges to ~10% standalone over the default
# 500-sale run.
STANDALONE_SALE_FRAC = 0.10

CITIES = list(ZONES_BY_CITY.keys())


def _ascii_slug(text: str) -> str:
    """Lowercase ASCII slug — strips diacritics so usernames/emails are URL-safe."""
    normalized = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return "".join(c for c in stripped if c.isalnum() or c in "._-").lower()


def _weighted_choice(rng: random.Random, weighted: list[tuple[str, int]]) -> str:
    items, weights = zip(*weighted, strict=True)
    return rng.choices(items, weights=weights, k=1)[0]


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Seed the TrueValue DB with Bolivia-context demo data.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--agents", type=int, default=DEFAULT_AGENTS)
    p.add_argument("--properties", type=int, default=DEFAULT_PROPERTIES)
    p.add_argument("--sales", type=int, default=DEFAULT_SALES)
    p.add_argument("--leads", type=int, default=DEFAULT_LEADS)
    p.add_argument(
        "--measurement-days",
        type=int,
        default=DEFAULT_MEASUREMENT_DAYS,
        help="Business days of office-hours measurement history (1/min cadence).",
    )
    p.add_argument(
        "--measurement-sensor-frac",
        type=float,
        default=DEFAULT_MEASUREMENT_SENSOR_FRAC,
        help="Fraction of seed properties that have ESP32 sensors installed.",
    )
    p.add_argument(
        "--open-house-frac",
        type=float,
        default=DEFAULT_OPEN_HOUSE_FRAC,
        help="Fraction of `venta` properties that hosted one open house in the last 30 days.",
    )
    p.add_argument(
        "--rng-seed",
        type=int,
        default=None,
        help="Seed the RNG for reproducible output.",
    )
    args = p.parse_args(argv)
    if args.agents < 1:
        p.error("--agents must be >= 1")
    if args.properties < 0 or args.sales < 0:
        p.error("--properties and --sales must be >= 0")
    if args.leads < 0:
        p.error("--leads must be >= 0")
    if args.measurement_days < 0:
        p.error("--measurement-days must be >= 0")
    if not 0.0 <= args.measurement_sensor_frac <= 1.0:
        p.error("--measurement-sensor-frac must be in [0, 1]")
    if not 0.0 <= args.open_house_frac <= 1.0:
        p.error("--open-house-frac must be in [0, 1]")
    return args


async def _wipe_seed_data() -> int:
    seed_users = await User.objects().where(User.email.ilike(f"%@{SEED_EMAIL_DOMAIN}")).run()
    if not seed_users:
        return 0
    seed_ids = [u.id for u in seed_users]

    # Leads are tagged via Lead.agent (SET NULL on user delete, so we must
    # delete by agent FK before wiping the users themselves — otherwise the
    # cascade would orphan them).
    await Lead.delete().where(Lead.agent.is_in(seed_ids)).run()

    # Edge data FKs Property with on_delete=RESTRICT — wipe it before properties.
    seed_props = await Property.objects().where(Property.agent.is_in(seed_ids)).run()
    seed_prop_ids = [p.id for p in seed_props]
    if seed_prop_ids:
        await Measurement.delete().where(Measurement.property.is_in(seed_prop_ids)).run()
        await VisitorEvent.delete().where(VisitorEvent.property.is_in(seed_prop_ids)).run()

    # Sales first (Sale.agent is RESTRICT; Sale.property is SET NULL).
    await Sale.delete().where(Sale.agent.is_in(seed_ids)).run()
    await Property.delete().where(Property.agent.is_in(seed_ids)).run()
    await User.delete().where(User.id.is_in(seed_ids)).run()
    return len(seed_ids)


async def _ensure_demo_admin() -> User:
    email = f"{DEMO_ADMIN_USERNAME}@{SEED_EMAIL_DOMAIN}"
    existing = await User.objects().where(User.username == DEMO_ADMIN_USERNAME).first().run()
    if existing is None:
        user = await User.create_user(
            username=DEMO_ADMIN_USERNAME,
            password=SEED_PASSWORD,
            email=email,
            first_name="Demo",
            last_name="Admin",
            active=True,
            admin=True,
            superuser=True,
        )
        print(f"created demo admin: {DEMO_ADMIN_USERNAME} / {SEED_PASSWORD}")
        return user
    existing.password = SEED_PASSWORD  # auto-hashed by BaseUser
    existing.email = email
    existing.active = True
    existing.admin = True
    existing.superuser = True
    await existing.save().run()
    print(f"refreshed demo admin: {DEMO_ADMIN_USERNAME} / {SEED_PASSWORD}")
    return existing


async def _create_agents(n: int, fake: Faker, rng: random.Random) -> list[User]:
    agents: list[User] = []
    used: set[str] = set()
    for _ in range(n):
        is_male = rng.random() < 0.5
        first = fake.first_name_male() if is_male else fake.first_name_female()
        apellido_paterno = rng.choice(APELLIDOS)
        apellido_materno = rng.choice(APELLIDOS)

        # Username pattern: seed_<first>.<paterno>  — ASCII-folded so it's URL-safe.
        slug = _ascii_slug(f"{first}.{apellido_paterno}")
        base = f"seed_{slug}"
        username = base
        suffix = 1
        while username in used:
            suffix += 1
            username = f"{base}{suffix}"
        used.add(username)

        email = f"{slug}{'' if suffix == 1 else suffix}@{SEED_EMAIL_DOMAIN}"
        user = await User.create_user(
            username=username,
            password=SEED_PASSWORD,
            email=email,
            first_name=first,
            last_name=f"{apellido_paterno} {apellido_materno}",
            active=True,
            admin=False,
            superuser=False,
        )
        agents.append(user)
    return agents


def _random_past_datetime(rng: random.Random, days_back: int) -> datetime:
    now = datetime.now(UTC)
    offset_seconds = rng.randint(0, days_back * 24 * 3600)
    return now - timedelta(seconds=offset_seconds)


def _build_property(rng: random.Random, agent_id: int) -> Property:
    city = rng.choice(CITIES)
    zona = rng.choice(ZONES_BY_CITY[city])
    tipo = rng.choice(PROPERTY_TYPES)
    feature = rng.choice(PROPERTY_FEATURES)

    bedrooms: int | None = None
    bathrooms: int | None = None
    garages: int | None = None
    floors: int | None = None
    area_total: int | None = None
    area_construida: int | None = None

    if tipo == "Departamento":
        rooms = rng.choice([1, 2, 2, 3, 3, 3, 4, 4, 5])
        bedrooms = rooms
        bathrooms = max(1, min(rooms, rng.choice([1, 2, 2, 3])))
        garages = rng.choice([0, 1, 1, 1, 2])
        area_construida = rng.randint(45, 220)
        area_total = area_construida
        title = f"{tipo} de {rooms} dormitorios, {feature}, en {zona}"
    elif tipo == "Casa":
        rooms = rng.choice([2, 3, 3, 3, 4, 4, 5])
        bedrooms = rooms
        bathrooms = max(1, rng.choice([rooms - 1, rooms]))
        garages = rng.choice([1, 2, 2, 3])
        floors = rng.choice([1, 2, 2, 3])
        area_construida = rng.randint(120, 500)
        area_total = area_construida + rng.randint(50, 600)
        title = f"{tipo} de {rooms} dormitorios, {feature}, en {zona}"
    elif tipo == "Terreno":
        m2 = rng.choice([200, 250, 300, 400, 500, 800, 1000, 1500, 2000])
        area_total = m2
        title = f"Terreno de {m2} m² en {zona}"
    elif tipo == "Oficina":
        m2 = rng.choice([30, 45, 60, 80, 120, 180, 250])
        area_construida = m2
        area_total = m2
        bathrooms = rng.choice([1, 1, 2])
        title = f"Oficina de {m2} m², {feature}, en {zona}"
    elif tipo == "Local comercial":
        area_construida = rng.choice([25, 40, 60, 90, 150, 250])
        area_total = area_construida
        title = f"Local comercial {feature} en {zona}"
    elif tipo == "Galpón":
        m2 = rng.choice([300, 500, 800, 1200, 2000, 3000])
        area_construida = m2
        area_total = m2 + rng.randint(50, 500)
        title = f"Galpón industrial de {m2} m² en {zona}"
    else:  # Quinta
        bedrooms = rng.choice([3, 4, 5])
        bathrooms = rng.choice([2, 3, 4])
        garages = rng.choice([2, 3])
        floors = rng.choice([1, 2])
        area_construida = rng.randint(200, 600)
        area_total = area_construida + rng.randint(1000, 5000)
        title = f"Quinta {feature} en {zona}"

    lo, hi = PRICE_RANGES_USD[(city, tipo)]
    raw = rng.uniform(lo, hi)
    price = Decimal(int(round(raw / 500) * 500))  # round to nearest $500

    # Año de construcción — sólo aplica si hay construcción.
    year_built = rng.randint(1985, 2024) if tipo != "Terreno" else None

    # Servicios: base siempre presente; gas natural según ciudad; resto al azar.
    utilities = list(UTILITIES_BASE)
    if rng.random() < GAS_NATURAL_PROB_BY_CITY[city]:
        utilities.append("gas natural")
    for extra in UTILITIES_EXTRA:
        if extra == "gas natural":
            continue
        if rng.random() < 0.55:
            utilities.append(extra)

    # Amenidades — terreno no tiene; el resto escala con el tier de precio.
    if tipo == "Terreno":
        amenities: list[str] = []
    else:
        price_pos = (raw - lo) / max(1.0, hi - lo)  # 0..1
        cap = max(1, int(price_pos * 6))
        n = rng.randint(0, min(5, cap))
        amenities = rng.sample(AMENITIES_POOL, k=n) if n > 0 else []

    listing_type = _weighted_choice(rng, LISTING_TYPES_WEIGHTED)
    legal_status = _weighted_choice(rng, LEGAL_STATUSES_WEIGHTED)

    return Property(
        title=title[:255],
        price=price,
        property_type=tipo,
        location=f"{zona}, {city}",
        agent=agent_id,
        created_at=_random_past_datetime(rng, days_back=PROPERTIES_DAYS_BACK),
        area_total_m2=area_total,
        area_construida_m2=area_construida,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        garages=garages,
        floors=floors,
        year_built=year_built,
        listing_type=listing_type,
        legal_status=legal_status,
        utilities=utilities,
        amenities=amenities,
    )


def _build_sale(
    rng: random.Random,
    agent_id: int,
    seed_properties: list[Property],
) -> Sale:
    # Decide the sale's category. If there are no properties to link to,
    # force standalone — a linked template with no FK target would fail.
    force_standalone = not seed_properties
    is_standalone = force_standalone or rng.random() < STANDALONE_SALE_FRAC

    if is_standalone:
        template, lo, hi = rng.choice(STANDALONE_SALES_TEMPLATES)
        link: Property | None = None
        city = rng.choice(CITIES)
        zona = rng.choice(ZONES_BY_CITY[city])
        location = f"{zona}, {city}"
        tipo = rng.choice(SALE_PROPERTY_TYPES)
    else:
        template, lo, hi = rng.choice(LINKED_SALES_TEMPLATES)
        link = rng.choice(seed_properties)
        # Use the linked property's actual zona/type for credibility.
        location = link.location
        tipo = link.property_type.lower()

    # Pull the zona out of "Zona, City" for templates that use {zona}.
    zona_for_template = location.split(",", 1)[0].strip()
    product = template.format(zona=zona_for_template, tipo=tipo)

    raw = rng.uniform(lo, hi)
    rounder = 50 if raw >= 1_000 else 5
    amount = Decimal(int(round(raw / rounder) * rounder))

    payment = rng.choice(HIGH_VALUE_PAYMENTS) if raw >= 5_000 else rng.choice(SERVICE_PAYMENTS)

    return Sale(
        product_or_service=product[:255],
        amount=amount,
        payment_method=payment,
        location=location[:255],
        sold_at=_random_past_datetime(rng, days_back=SALES_DAYS_BACK),
        agent=agent_id,
        property=link.id if link is not None else None,
    )


def _bolivian_mobile(rng: random.Random) -> str:
    """Return a Bolivia-style 8-digit mobile number, formatted ``7XX XXXXX``.

    Real Bolivian mobile prefixes start with 6 or 7 (Entel / Tigo / Viva).
    Faker's default ``phone_number`` produces US-style numbers, so we roll
    our own.
    """
    prefix = rng.choice(["6", "7"])
    rest = "".join(str(rng.randint(0, 9)) for _ in range(7))
    return f"{prefix}{rest[:2]} {rest[2:]}"


def _build_lead(rng: random.Random, agent_id: int, fake: Faker) -> Lead:
    is_male = rng.random() < 0.5
    first = fake.first_name_male() if is_male else fake.first_name_female()
    apellido_paterno = rng.choice(APELLIDOS)
    apellido_materno = rng.choice(APELLIDOS)
    full_name = f"{first} {apellido_paterno} {apellido_materno}"

    phone = _bolivian_mobile(rng) if rng.random() < 0.85 else None

    if rng.random() < 0.60:
        slug = _ascii_slug(f"{first}.{apellido_paterno}")
        # Append a 1–2 digit suffix on ~30% of emails so collisions are rare
        # when we generate many leads with similar names.
        suffix = str(rng.randint(1, 99)) if rng.random() < 0.30 else ""
        email = f"{slug}{suffix}@{rng.choice(LEAD_EMAIL_DOMAINS)}"
    else:
        email = None

    source = _weighted_choice(rng, LEAD_SOURCES_WEIGHTED)
    status = _weighted_choice(rng, LEAD_STATUSES_WEIGHTED)
    intent = _weighted_choice(rng, LISTING_TYPES_WEIGHTED)

    # Budget bands by intent, with realistic spread per Bolivian market.
    if intent == "venta":
        bmin = (rng.randint(40_000, 200_000) // 500) * 500
        bmax = (int(bmin * rng.uniform(1.3, 2.5)) // 500) * 500
    elif intent == "alquiler":
        bmin = (rng.randint(200, 800) // 50) * 50
        bmax = (int(bmin * rng.uniform(1.2, 2.0)) // 50) * 50
    else:  # anticretico
        bmin = (rng.randint(8_000, 30_000) // 500) * 500
        bmax = (int(bmin * rng.uniform(1.3, 2.0)) // 500) * 500

    # Zone preferences: 80% single-city search, 20% mixed across cities.
    if rng.random() < 0.80:
        pool = ZONES_BY_CITY[rng.choice(CITIES)]
    else:
        pool = [z for zones in ZONES_BY_CITY.values() for z in zones]
    n_zonas = min(rng.randint(1, 3), len(pool))
    zonas = rng.sample(pool, k=n_zonas)

    bedrooms_min = rng.choice(LEAD_BEDROOMS_MIN_CHOICES) if rng.random() < 0.40 else None
    area_min_m2 = rng.choice(LEAD_AREA_MIN_CHOICES) if rng.random() < 0.30 else None

    n_musts = rng.randint(0, 3)
    must_haves = rng.sample(LEAD_MUST_HAVES, k=n_musts) if n_musts > 0 else []

    notes = rng.choice(LEAD_NOTES_TEMPLATES) if rng.random() < 0.70 else ""

    return Lead(
        full_name=full_name[:255],
        phone=phone,
        email=email,
        source=source,
        agent=agent_id,
        status=status,
        intent=intent,
        budget_min_usd=Decimal(bmin),
        budget_max_usd=Decimal(bmax),
        zonas=zonas,
        bedrooms_min=bedrooms_min,
        area_min_m2=area_min_m2,
        must_haves=must_haves,
        notes=notes,
        created_at=_random_past_datetime(rng, days_back=LEADS_DAYS_BACK),
    )


def _last_business_days(n: int) -> list[datetime]:
    """Return the last `n` business days at midnight UTC, oldest first.

    Only Mon–Fri (per OFFICE_WEEKDAYS). Today is excluded so the window is
    fully in the past — the UI always sees complete office days.
    """
    if n <= 0:
        return []
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    out: list[datetime] = []
    cursor = today
    while len(out) < n:
        cursor -= timedelta(days=1)
        if cursor.weekday() in OFFICE_WEEKDAYS:
            out.append(cursor)
    return list(reversed(out))


# Presence weights while a sensor's room is "in a meeting" — flips the
# distribution so still/moving dominate. Order matches PRESENCE_WEIGHTED keys.
_MEETING_PRESENCE = [
    ("still", 55),
    ("moving", 30),
    ("moving+still", 10),
    ("no target", 5),
]


async def _seed_measurements(
    seed_properties: list[Property],
    rng: random.Random,
    args: argparse.Namespace,
) -> tuple[int, int]:
    """Build a per-minute office-hours time-series per (property, sensor)."""
    business_days = _last_business_days(args.measurement_days)
    if not business_days or not seed_properties:
        return 0, 0

    rows: list[Measurement] = []
    n_sensors = 0

    for prop in seed_properties:
        if rng.random() >= args.measurement_sensor_frac:
            continue
        n_for_prop = rng.randint(2, 4)
        rooms = rng.sample(SENSOR_ROOMS, k=n_for_prop)

        for room in rooms:
            n_sensors += 1
            sensor_id = f"esp32-{prop.id}-{room}"
            # Per-sensor environment baselines that drift across the day.
            temp = rng.uniform(15.0, 22.0)
            humid = rng.uniform(45.0, 60.0)

            for day in business_days:
                # One "meeting" window per (sensor, day), 30–90 min, fully inside
                # office hours so the bias applies cleanly.
                latest_start = OFFICE_HOURS_END * 60 - 30
                meet_start = rng.randint(OFFICE_HOURS_START * 60 + 30, latest_start)
                meet_end = min(meet_start + rng.randint(30, 90), OFFICE_HOURS_END * 60)

                for minute in range(OFFICE_HOURS_START * 60, OFFICE_HOURS_END * 60):
                    temp = max(12.0, min(28.0, temp + rng.uniform(-0.1, 0.1)))
                    humid = max(30.0, min(75.0, humid + rng.uniform(-0.5, 0.5)))

                    in_meeting = meet_start <= minute < meet_end
                    presence = _weighted_choice(
                        rng, _MEETING_PRESENCE if in_meeting else PRESENCE_WEIGHTED
                    )

                    ts = day.replace(hour=minute // 60, minute=minute % 60)
                    rows.append(
                        Measurement(
                            temperature=Decimal(f"{temp:.2f}"),
                            humidity=Decimal(f"{humid:.2f}"),
                            presence=presence,
                            room=room,
                            sensor_id=sensor_id,
                            property=prop.id,
                            created_at=ts,
                        )
                    )

    await _insert_in_chunks(Measurement, rows, chunk_size=500)
    return n_sensors, len(rows)


async def _seed_open_houses(
    seed_properties: list[Property],
    rng: random.Random,
    args: argparse.Namespace,
) -> tuple[int, int]:
    """Generate paired in/out visitor events for ~`open_house_frac` of venta props."""
    venta = [p for p in seed_properties if p.listing_type == "venta"]
    if not venta:
        return 0, 0
    n_to_pick = round(len(venta) * args.open_house_frac)
    if n_to_pick <= 0:
        return 0, 0
    selected = rng.sample(venta, k=min(n_to_pick, len(venta)))

    rows: list[VisitorEvent] = []
    n_houses = 0
    now = datetime.now(UTC)

    for prop in selected:
        # Pick a random weekend day in the last 30 days.
        chosen_day = None
        for _ in range(60):
            days_ago = rng.randint(1, 30)
            candidate = (now - timedelta(days=days_ago)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            if candidate.weekday() in (5, 6):  # Sat or Sun
                chosen_day = candidate
                break
        if chosen_day is None:
            continue
        n_houses += 1

        # Open-house window 18:00–21:00 UTC ≈ 14:00–17:00 La Paz local.
        window_start = chosen_day.replace(hour=18)
        window_end = chosen_day.replace(hour=21)
        window_seconds = int((window_end - window_start).total_seconds())
        buffer_end = window_end + timedelta(minutes=30)

        n_visitors = rng.randint(10, 50)
        for _ in range(n_visitors):
            entrance_in_ts = window_start + timedelta(seconds=rng.randint(0, window_seconds - 300))
            visit_minutes = rng.randint(5, 60)
            entrance_out_ts = entrance_in_ts + timedelta(minutes=visit_minutes)
            if entrance_out_ts > buffer_end:
                entrance_out_ts = buffer_end - timedelta(minutes=rng.randint(1, 10))

            rows.append(
                VisitorEvent(
                    room=VISITOR_ENTRANCE_ROOM,
                    event="in",
                    timestamp=entrance_in_ts,
                    property=prop.id,
                )
            )
            rows.append(
                VisitorEvent(
                    room=VISITOR_ENTRANCE_ROOM,
                    event="out",
                    timestamp=entrance_out_ts,
                    property=prop.id,
                )
            )

            # 70% of visitors also dwell in one interior room — but only emit
            # the pair if it fits inside the entrance window so in/out counts
            # stay balanced per room.
            if rng.random() < 0.7:
                interior = rng.choice(VISITOR_INTERIOR_ROOMS)
                room_in_ts = entrance_in_ts + timedelta(minutes=rng.randint(1, 15))
                room_out_ts = room_in_ts + timedelta(minutes=rng.randint(2, 10))
                if room_out_ts < entrance_out_ts:
                    rows.append(
                        VisitorEvent(
                            room=interior,
                            event="in",
                            timestamp=room_in_ts,
                            property=prop.id,
                        )
                    )
                    rows.append(
                        VisitorEvent(
                            room=interior,
                            event="out",
                            timestamp=room_out_ts,
                            property=prop.id,
                        )
                    )

    await _insert_in_chunks(VisitorEvent, rows, chunk_size=500)
    return n_houses, len(rows)


async def _insert_in_chunks(table_cls, rows: list, chunk_size: int = 100) -> None:
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        await table_cls.insert(*chunk).run()


async def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)

    rng = random.Random(args.rng_seed)
    fake = Faker("es_ES")
    if args.rng_seed is not None:
        Faker.seed(args.rng_seed)

    wiped = await _wipe_seed_data()
    if wiped:
        print(f"wiped {wiped} existing seed agents (and their properties/sales)")

    await _ensure_demo_admin()

    agents = await _create_agents(args.agents, fake, rng)
    print(f"created {len(agents)} agents")
    agent_ids = [a.id for a in agents]

    properties = [_build_property(rng, rng.choice(agent_ids)) for _ in range(args.properties)]
    await _insert_in_chunks(Property, properties)
    print(f"inserted {len(properties)} properties")

    # Re-fetch with IDs so sales can link to specific property rows.
    seed_properties: list[Property] = (
        await Property.objects().where(Property.agent.is_in(agent_ids)).run()
    )

    sales = [_build_sale(rng, rng.choice(agent_ids), seed_properties) for _ in range(args.sales)]
    await _insert_in_chunks(Sale, sales)
    linked = sum(1 for s in sales if s.property is not None)
    print(f"inserted {len(sales)} sales ({linked} linked to a property)")

    n_sensors, n_measurements = await _seed_measurements(seed_properties, rng, args)
    print(f"inserted {n_measurements} measurements across {n_sensors} sensors")

    n_open_houses, n_events = await _seed_open_houses(seed_properties, rng, args)
    print(f"inserted {n_events} visitor events across {n_open_houses} open houses")

    if args.leads > 0:
        leads = [_build_lead(rng, rng.choice(agent_ids), fake) for _ in range(args.leads)]
        await _insert_in_chunks(Lead, leads)
        print(f"inserted {len(leads)} leads")

    print("seed complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(130)
