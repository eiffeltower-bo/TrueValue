from __future__ import annotations

from enum import Enum

from piccolo.columns import ForeignKey, Numeric, OnDelete, Timestamptz, Varchar
from piccolo.columns.defaults.timestamptz import TimestamptzNow
from piccolo.table import Table

from app.schemas.visitor_events import EventType
from app.tables.properties import Property


class VisitorEvent(Table, tablename="visitor_events"):
    room = Numeric(digits=(5, 0))
    event = Varchar(choices=EventType, length=7)
    timestamp = Timestamptz(default=TimestamptzNow())
    property = ForeignKey(references=Property, on_delete=OnDelete.restrict)
