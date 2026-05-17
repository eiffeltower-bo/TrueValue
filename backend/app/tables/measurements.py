from __future__ import annotations

from piccolo.columns import ForeignKey, Numeric, OnDelete, Timestamptz, Varchar
from piccolo.columns.defaults.timestamptz import TimestamptzNow
from piccolo.table import Table

from app.tables.users import User
from app.tables.properties import Property

class Measurement(Table, tablename="measurements"):
    temperature = Numeric(digits=(12,2), null=True)
    humidity = Numeric(digits=(12, 2), null=True)
    presence = Varchar(length=12)
    room = Varchar(length=255)
    sensor_id = Varchar(length=255)
    property = ForeignKey(references=Property, on_delete=OnDelete.restrict)
    created_at = Timestamptz(default=TimestamptzNow())
