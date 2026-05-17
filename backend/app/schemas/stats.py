from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

RangeKey = Literal["30d", "90d", "365d"]
GroupByKey = Literal["property_type", "listing_type"]


class SalesOverTimeBucket(BaseModel):
    date: str  # YYYY-MM-DD
    series: dict[str, Decimal]


class SalesOverTimeResponse(BaseModel):
    range: str  # "30d" | "90d" | "365d" | "custom"
    start_date: date
    end_date: date
    group_by: GroupByKey
    keys: list[str]
    buckets: list[SalesOverTimeBucket]
    totals: dict[str, Decimal]


class InventoryResponse(BaseModel):
    total: int
    by_type: dict[str, int]
    by_listing_type: dict[str, int]


class TopAgentEntry(BaseModel):
    agent_id: int
    full_name: str
    sales_count: int
    sales_total_usd: Decimal


class HotNeighborhoodEntry(BaseModel):
    zona: str
    sales_count: int
    sales_total_usd: Decimal


class CommissionsResponse(BaseModel):
    range: str
    start_date: date
    end_date: date
    total_usd: Decimal
    count: int
    by_kind: dict[str, Decimal]  # "venta" | "alquiler" | "administración" | "otros"


class ConversionRateResponse(BaseModel):
    range: str
    start_date: date
    end_date: date
    listings_total: int  # properties with listing_type=venta
    listings_sold: int  # of those, ones with ≥1 "Comisión venta" sale in window
    rate: float  # listings_sold / listings_total, 0..1; 0 when denominator is 0


class LeadsCountResponse(BaseModel):
    range: str
    start_date: date
    end_date: date
    total: int
    open: int  # statuses other than closed/lost
    by_status: dict[str, int]
