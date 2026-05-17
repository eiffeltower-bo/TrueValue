from __future__ import annotations

from piccolo.columns import (
    Array,
    ForeignKey,
    Integer,
    Numeric,
    OnDelete,
    SmallInt,
    Timestamptz,
    Varchar,
)
from piccolo.columns.defaults.timestamptz import TimestamptzNow
from piccolo.table import Table

from app.tables.users import User


class Property(Table, tablename="properties"):
    title = Varchar(length=255)
    price = Numeric(digits=(12, 2))
    property_type = Varchar(length=64)
    location = Varchar(length=255)
    agent = ForeignKey(references=User, on_delete=OnDelete.restrict)
    created_at = Timestamptz(default=TimestamptzNow())

    # Bolivia-typical optional fields. All nullable so partial data is fine.
    area_total_m2 = Integer(null=True)
    area_construida_m2 = Integer(null=True)
    bedrooms = SmallInt(null=True)
    bathrooms = SmallInt(null=True)
    garages = SmallInt(null=True)
    floors = SmallInt(null=True)
    year_built = SmallInt(null=True)
    listing_type = Varchar(length=16, default="venta")  # venta | alquiler | anticretico
    legal_status = Varchar(
        length=32, null=True
    )  # saneado | en_tramite | con_observaciones | pendiente
    utilities = Array(base_column=Varchar(length=32), default=list)
    amenities = Array(base_column=Varchar(length=48), default=list)
