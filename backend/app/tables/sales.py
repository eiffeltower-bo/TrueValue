from __future__ import annotations

from piccolo.columns import ForeignKey, Numeric, OnDelete, Timestamptz, Varchar
from piccolo.columns.defaults.timestamptz import TimestamptzNow
from piccolo.table import Table

from app.tables.users import User


class Sale(Table, tablename="sales"):
    product_or_service = Varchar(length=255)
    amount = Numeric(digits=(12, 2))
    payment_method = Varchar(length=32)
    location = Varchar(length=255)
    sold_at = Timestamptz(default=TimestamptzNow())
    agent = ForeignKey(references=User, on_delete=OnDelete.restrict)
