from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter

from app.schemas.visitor_events import VisitorEventRead
from app.tables.visitor_events import VisitorEvent

router = APIRouter(prefix="/visitor-events", tags=["visitor-events"])


def _to_read(row: VisitorEvent) -> VisitorEventRead:
    return VisitorEventRead(
        id=row.id,
        room=int(row.room),
        event=row.event,
        timestamp=row.timestamp,
        property_id=row.property,
    )


@router.get("", response_model=list[VisitorEventRead])
async def list_visitor_events(
    property_id: int,
    since: datetime | None = None,
) -> list[VisitorEventRead]:
    """All visitor events for a property since `since` (ISO 8601), ordered
    oldest first. Default window is 30 days back so a freshly-seeded demo
    always renders historical open houses.
    """
    since = since or datetime.now(UTC) - timedelta(days=30)
    rows = (
        await VisitorEvent.objects()
        .where(VisitorEvent.property == property_id, VisitorEvent.timestamp >= since)
        .order_by(VisitorEvent.timestamp)
        .run()
    )
    return [_to_read(r) for r in rows]
