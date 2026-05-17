from __future__ import annotations

import builtins
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.stats import (
    CommissionsResponse,
    ConversionRateResponse,
    GroupByKey,
    HotNeighborhoodEntry,
    InventoryResponse,
    LeadsCountResponse,
    RangeKey,
    SalesOverTimeBucket,
    SalesOverTimeResponse,
    TopAgentEntry,
)
from app.tables.leads import Lead
from app.tables.properties import Property
from app.tables.sales import Sale

# `range` is the query-param name we expose to clients; alias the builtin so
# handlers can still iterate ranges of integers locally.
_builtin_range = builtins.range

router = APIRouter(prefix="/stats", tags=["stats"])

RANGE_DAYS: dict[str, int] = {"30d": 30, "90d": 90, "365d": 365}

# Sales whose `property` FK is NULL (notarial fees, asesoría, etc.) get bucketed
# under this key so the per-series sum still reconciles with the grand total.
SERVICES_KEY = "Servicios"

# Max custom window we'll accept. Keeps unbounded scans off the dashboard and
# matches the longest preset.
_MAX_CUSTOM_DAYS = 365 * 3


def _resolve_window(
    range_key: RangeKey,
    start: date | None,
    end: date | None,
) -> tuple[datetime, datetime, str, date, date]:
    """Resolve the analysis window from either a preset range or explicit
    start/end dates.

    Returns (start_dt, end_dt, label, start_date, end_date).

    `start_dt`/`end_dt` are timezone-aware UTC datetimes suitable for `>=` and
    `<=` comparisons against Timestamptz columns. `label` is "30d" | "90d" |
    "365d" | "custom" so the response can echo what was actually used.
    """
    if start is not None or end is not None:
        if start is None or end is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date and end_date must be provided together",
            )
        if end < start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="end_date must be on or after start_date",
            )
        span = (end - start).days
        if span > _MAX_CUSTOM_DAYS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"custom window may not exceed {_MAX_CUSTOM_DAYS} days",
            )
        start_dt = datetime.combine(start, datetime.min.time(), tzinfo=UTC)
        # End is inclusive — include the entire end-day.
        end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
        return start_dt, end_dt, "custom", start, end

    days = RANGE_DAYS[range_key]
    now = datetime.now(UTC)
    start_dt = now - timedelta(days=days)
    end_dt = now
    return start_dt, end_dt, range_key, start_dt.date(), end_dt.date()


@router.get("/sales-over-time", response_model=SalesOverTimeResponse)
async def sales_over_time(
    range: Annotated[RangeKey, Query()] = "90d",
    group_by: Annotated[GroupByKey, Query()] = "property_type",
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> SalesOverTimeResponse:
    start_dt, end_dt, label, start_d, end_d = _resolve_window(range, start_date, end_date)

    rows = (
        await Sale.select(
            Sale.sold_at,
            Sale.amount,
            Sale.property.property_type.as_alias("ptype"),
            Sale.property.listing_type.as_alias("ltype"),
        )
        .where((Sale.sold_at >= start_dt) & (Sale.sold_at < end_dt))
        .run()
    )

    key_field = "ptype" if group_by == "property_type" else "ltype"

    # totals[series_key] and buckets[date_iso][series_key] = sum of amounts
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    by_day: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(lambda: Decimal("0")))

    for row in rows:
        amount: Decimal = row["amount"]
        sold_at: datetime = row["sold_at"]
        series_key = row.get(key_field) or SERVICES_KEY
        date_iso = sold_at.date().isoformat()
        totals[series_key] += amount
        by_day[date_iso][series_key] += amount

    keys = sorted(totals.keys())

    # Emit a continuous daily axis from start..end-inclusive so charts don't
    # have gaps. We iterate from start_d to end_d inclusive.
    days_span = (end_d - start_d).days + 1
    buckets: list[SalesOverTimeBucket] = []
    for offset in _builtin_range(days_span):
        d = start_d + timedelta(days=offset)
        iso = d.isoformat()
        day_series = by_day.get(iso, {})
        buckets.append(
            SalesOverTimeBucket(
                date=iso,
                series={k: day_series.get(k, Decimal("0")) for k in keys},
            )
        )

    return SalesOverTimeResponse(
        range=label,
        start_date=start_d,
        end_date=end_d,
        group_by=group_by,
        keys=keys,
        buckets=buckets,
        totals=dict(totals),
    )


@router.get("/inventory", response_model=InventoryResponse)
async def inventory() -> InventoryResponse:
    rows = await Property.select(Property.property_type, Property.listing_type).run()
    by_type: dict[str, int] = defaultdict(int)
    by_listing_type: dict[str, int] = defaultdict(int)
    for row in rows:
        by_type[row["property_type"]] += 1
        by_listing_type[row["listing_type"]] += 1
    return InventoryResponse(
        total=len(rows),
        by_type=dict(by_type),
        by_listing_type=dict(by_listing_type),
    )


@router.get("/top-agents", response_model=list[TopAgentEntry])
async def top_agents(
    range: Annotated[RangeKey, Query()] = "90d",
    limit: Annotated[int, Query(ge=1, le=50)] = 5,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> list[TopAgentEntry]:
    start_dt, end_dt, _label, _sd, _ed = _resolve_window(range, start_date, end_date)
    rows = (
        await Sale.select(
            Sale.agent.id.as_alias("agent_id"),
            Sale.agent.first_name.as_alias("first_name"),
            Sale.agent.last_name.as_alias("last_name"),
            Sale.agent.username.as_alias("username"),
            Sale.amount,
        )
        .where((Sale.sold_at >= start_dt) & (Sale.sold_at < end_dt))
        .run()
    )

    totals: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    counts: dict[int, int] = defaultdict(int)
    names: dict[int, str] = {}
    for row in rows:
        aid = row["agent_id"]
        totals[aid] += row["amount"]
        counts[aid] += 1
        if aid not in names:
            first = row.get("first_name") or ""
            last = row.get("last_name") or ""
            full = f"{first} {last}".strip()
            names[aid] = full or row.get("username") or f"agent #{aid}"

    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [
        TopAgentEntry(
            agent_id=aid,
            full_name=names[aid],
            sales_count=counts[aid],
            sales_total_usd=total,
        )
        for aid, total in ranked
    ]


@router.get("/hot-neighborhoods", response_model=list[HotNeighborhoodEntry])
async def hot_neighborhoods(
    city: Annotated[str, Query(min_length=1, max_length=64)],
    range: Annotated[RangeKey, Query()] = "90d",
    limit: Annotated[int, Query(ge=1, le=50)] = 5,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> list[HotNeighborhoodEntry]:
    if not city.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="city is required")
    start_dt, end_dt, _label, _sd, _ed = _resolve_window(range, start_date, end_date)
    rows = (
        await Sale.select(Sale.location, Sale.amount)
        .where((Sale.sold_at >= start_dt) & (Sale.sold_at < end_dt))
        .run()
    )

    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    counts: dict[str, int] = defaultdict(int)
    city_target = city.strip().lower()
    for row in rows:
        loc = (row.get("location") or "").strip()
        if ", " not in loc:
            continue
        zona, parsed_city = loc.split(", ", 1)
        if parsed_city.strip().lower() != city_target:
            continue
        zona = zona.strip()
        if not zona:
            continue
        totals[zona] += row["amount"]
        counts[zona] += 1

    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [
        HotNeighborhoodEntry(zona=zona, sales_count=counts[zona], sales_total_usd=total)
        for zona, total in ranked
    ]


# Commission-bucket detection. Seed templates capitalize "Comisión" with an
# accent (see app/seed/bolivia_data.py::LINKED_SALES_TEMPLATES). We narrow to
# actual commission income — venta, alquiler, administración — and skip the
# deposit / anticrético templates which are security deposits or principal
# transfers, not brokerage income.
_COMMISSION_PREFIX = "Comisión"
_COMMISSION_KINDS: tuple[tuple[str, str], ...] = (
    ("Comisión venta", "venta"),
    ("Comisión alquiler", "alquiler"),
    ("Comisión administración", "administración"),
)


def _commission_kind(product_or_service: str) -> str | None:
    if not product_or_service.startswith(_COMMISSION_PREFIX):
        return None
    for prefix, kind in _COMMISSION_KINDS:
        if product_or_service.startswith(prefix):
            return kind
    return "otros"


@router.get("/commissions", response_model=CommissionsResponse)
async def commissions(
    range: Annotated[RangeKey, Query()] = "90d",
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> CommissionsResponse:
    start_dt, end_dt, label, start_d, end_d = _resolve_window(range, start_date, end_date)
    rows = (
        await Sale.select(Sale.product_or_service, Sale.amount)
        .where((Sale.sold_at >= start_dt) & (Sale.sold_at < end_dt))
        .run()
    )

    total = Decimal("0")
    count = 0
    by_kind: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for row in rows:
        kind = _commission_kind(row["product_or_service"] or "")
        if kind is None:
            continue
        amount: Decimal = row["amount"]
        total += amount
        count += 1
        by_kind[kind] += amount

    return CommissionsResponse(
        range=label,
        start_date=start_d,
        end_date=end_d,
        total_usd=total,
        count=count,
        by_kind=dict(by_kind),
    )


@router.get("/conversion", response_model=ConversionRateResponse)
async def conversion_rate(
    range: Annotated[RangeKey, Query()] = "90d",
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> ConversionRateResponse:
    start_dt, end_dt, label, start_d, end_d = _resolve_window(range, start_date, end_date)

    # Denominator: every listing currently for sale.
    listings_total = await Property.count().where(Property.listing_type == "venta").run()

    # Numerator: distinct property_ids that have ≥1 "Comisión venta*" sale in
    # the window AND whose property is still listing_type=venta.
    sold_rows = (
        await Sale.select(Sale.property.id.as_alias("property_id"))
        .where(
            (Sale.sold_at >= start_dt)
            & (Sale.sold_at < end_dt)
            & (Sale.product_or_service.like("Comisión venta%"))
            & (Sale.property.listing_type == "venta")
        )
        .run()
    )
    listings_sold = len({row["property_id"] for row in sold_rows if row["property_id"]})

    rate = (listings_sold / listings_total) if listings_total > 0 else 0.0
    return ConversionRateResponse(
        range=label,
        start_date=start_d,
        end_date=end_d,
        listings_total=listings_total,
        listings_sold=listings_sold,
        rate=rate,
    )


# Statuses considered "open" — counted toward the "active leads" KPI.
_OPEN_LEAD_STATUSES: frozenset[str] = frozenset({"new", "contacted", "visiting", "negotiating"})


@router.get("/leads-count", response_model=LeadsCountResponse)
async def leads_count(
    range: Annotated[RangeKey, Query()] = "90d",
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> LeadsCountResponse:
    """Count of potential clients (leads) created in the window, broken down
    by pipeline status. Date filter is applied on `created_at`."""
    start_dt, end_dt, label, start_d, end_d = _resolve_window(range, start_date, end_date)

    rows = (
        await Lead.select(Lead.status)
        .where((Lead.created_at >= start_dt) & (Lead.created_at < end_dt))
        .run()
    )

    by_status: dict[str, int] = defaultdict(int)
    for row in rows:
        by_status[row["status"]] += 1

    total = sum(by_status.values())
    open_count = sum(v for k, v in by_status.items() if k in _OPEN_LEAD_STATUSES)

    return LeadsCountResponse(
        range=label,
        start_date=start_d,
        end_date=end_d,
        total=total,
        open=open_count,
        by_status=dict(by_status),
    )
