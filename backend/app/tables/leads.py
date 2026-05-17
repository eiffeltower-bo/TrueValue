from __future__ import annotations

from piccolo.columns import (
    Array,
    ForeignKey,
    Integer,
    Numeric,
    OnDelete,
    SmallInt,
    Text,
    Timestamptz,
    Varchar,
)
from piccolo.columns.defaults.timestamptz import TimestamptzNow
from piccolo.table import Table

from app.tables.users import User


class Lead(Table, tablename="leads"):
    # Identity
    full_name = Varchar(length=255)
    phone = Varchar(length=32, null=True)
    email = Varchar(length=255, null=True)
    source = Varchar(length=32, default="walk_in")  # walk_in | referral | web | open_house | other

    # Assignment + pipeline status
    agent = ForeignKey(references=User, null=True, on_delete=OnDelete.set_null)
    status = Varchar(
        length=24, default="new"
    )  # new | contacted | visiting | negotiating | closed | lost

    # Stated preferences
    intent = Varchar(length=16, default="venta")  # venta | alquiler | anticretico
    budget_min_usd = Numeric(digits=(12, 2), null=True)
    budget_max_usd = Numeric(digits=(12, 2), null=True)
    zonas = Array(base_column=Varchar(length=64), default=list)
    bedrooms_min = SmallInt(null=True)
    area_min_m2 = Integer(null=True)
    must_haves = Array(base_column=Varchar(length=48), default=list)
    notes = Text(default="")

    created_at = Timestamptz(default=TimestamptzNow())
