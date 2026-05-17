"""Populate the database with credible Bolivia-context demo data.

Seed data is tagged by the ``@seed.truevalue.local`` email domain. Re-running
the script wipes only tagged rows (and their properties / sales) before
re-inserting, so real users and any data they own are untouched.

Run from the ``backend/`` directory::

    uv run python -m scripts.seed_demo                                # defaults
    uv run python -m scripts.seed_demo --agents 50 --properties 1000 --sales 3000
    uv run python -m scripts.seed_demo --rng-seed 42                  # reproducible

Defaults: 25 agents, 200 properties, 500 sales. Also creates / refreshes a
demo admin (``seed_admin`` / ``seed-demo-1234``) so a fresh environment is
immediately usable.
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
    COMMISSION_TEMPLATE_PREFIXES,
    GAS_NATURAL_PROB_BY_CITY,
    HIGH_VALUE_PAYMENTS,
    LEGAL_STATUSES_WEIGHTED,
    LISTING_TYPES_WEIGHTED,
    PRICE_RANGES_USD,
    PROPERTY_FEATURES,
    PROPERTY_TYPES,
    SALE_PROPERTY_TYPES,
    SALES_TEMPLATES,
    SERVICE_PAYMENTS,
    UTILITIES_BASE,
    UTILITIES_EXTRA,
    ZONES_BY_CITY,
)
from app.tables.properties import Property
from app.tables.sales import Sale
from app.tables.users import User

SEED_EMAIL_DOMAIN = "seed.truevalue.local"
SEED_PASSWORD = "seed-demo-1234"  # documented; only set on seed_* accounts
DEMO_ADMIN_USERNAME = "seed_admin"

DEFAULT_AGENTS = 25
DEFAULT_PROPERTIES = 200
DEFAULT_SALES = 500

# Probability that a non-commission sale (notarial, asesoría, etc.) is still
# linked to a property — most aren't, but a few are tied to a specific deal.
NON_COMMISSION_LINK_PROB = 0.30

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
    return args


async def _wipe_seed_data() -> int:
    seed_users = await User.objects().where(User.email.ilike(f"%@{SEED_EMAIL_DOMAIN}")).run()
    if not seed_users:
        return 0
    seed_ids = [u.id for u in seed_users]
    # Delete sales first (they FK both agent and property). Property delete is
    # safe because Sale.property is SET NULL on delete.
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
        created_at=_random_past_datetime(rng, days_back=270),
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
    template, lo, hi = rng.choice(SALES_TEMPLATES)
    is_commission = template.startswith(COMMISSION_TEMPLATE_PREFIXES)

    # Commissions always link to a property when we have any; other services
    # sometimes do, mostly don't.
    link = None
    if seed_properties and (is_commission or rng.random() < NON_COMMISSION_LINK_PROB):
        link = rng.choice(seed_properties)

    if link is not None:
        # Use the linked property's actual zona/type for credibility.
        location = link.location
        tipo = link.property_type.lower()
    else:
        city = rng.choice(CITIES)
        zona = rng.choice(ZONES_BY_CITY[city])
        location = f"{zona}, {city}"
        tipo = rng.choice(SALE_PROPERTY_TYPES)

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
        sold_at=_random_past_datetime(rng, days_back=365),
        agent=agent_id,
        property=link.id if link is not None else None,
    )


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

    print("seed complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(130)
