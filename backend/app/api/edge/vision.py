from __future__ import annotations

from fastapi import APIRouter, status

from app.schemas.visitor_events import EventCreate
from app.tables.visitor_events import VisitorEvent

router = APIRouter(prefix="/vision", tags=["vision"])




@router.post("/event", status_code=status.HTTP_204_NO_CONTENT)
async def create_event(payload: EventCreate) -> None:
    print(f"Event received: {payload}")
    event = VisitorEvent(
        property=payload.property_id,
        room=payload.room,
        event=payload.event,
    )
    await event.save().run()

