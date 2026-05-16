from __future__ import annotations

from piccolo.columns import ForeignKey, Numeric, OnDelete, Timestamptz, Varchar
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
