from __future__ import annotations

from piccolo.columns import ForeignKey, OnDelete, Timestamptz, Varchar
from piccolo.columns.defaults.timestamptz import TimestamptzNow
from piccolo.table import Table

from app.tables.leads import Lead
from app.tables.properties import Property
from app.tables.users import User


class Showing(Table, tablename="showings"):
    # A time-windowed visit of one lead to one property, opened/closed by an
    # agent in the field. Used as the attribution window so anonymous edge
    # telemetry (visitor_events, measurements) at the property during this
    # window can be rolled up per lead.
    lead = ForeignKey(references=Lead, on_delete=OnDelete.cascade)
    property = ForeignKey(references=Property, on_delete=OnDelete.cascade)
    agent = ForeignKey(references=User, null=True, on_delete=OnDelete.set_null)

    started_at = Timestamptz(default=TimestamptzNow())
    ended_at = Timestamptz(null=True)

    source = Varchar(length=16, default="manual")  # manual | qr | appointment
