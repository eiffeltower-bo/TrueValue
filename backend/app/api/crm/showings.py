from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.showings import ShowingCreate, ShowingRead
from app.tables.leads import Lead
from app.tables.properties import Property
from app.tables.showings import Showing
from app.tables.users import User

router = APIRouter(prefix="/showings", tags=["showings"])


def _to_read(s: Showing) -> ShowingRead:
    return ShowingRead(
        id=s.id,
        lead_id=s.lead,
        property_id=s.property,
        agent_id=s.agent or None,
        started_at=s.started_at,
        ended_at=s.ended_at,
        source=s.source,
    )


@router.post("", response_model=ShowingRead, status_code=status.HTTP_201_CREATED)
async def start_showing(payload: ShowingCreate) -> ShowingRead:
    if not await Lead.exists().where(Lead.id == payload.lead_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"lead {payload.lead_id} not found"
        )
    if not await Property.exists().where(Property.id == payload.property_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"property {payload.property_id} not found",
        )
    if payload.agent_id is not None and not await User.exists().where(
        User.id == payload.agent_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"agent {payload.agent_id} not found",
        )

    showing = Showing(
        lead=payload.lead_id,
        property=payload.property_id,
        agent=payload.agent_id,
        source=payload.source,
    )
    await showing.save().run()
    return _to_read(showing)


@router.get("", response_model=list[ShowingRead])
async def list_showings(
    lead_id: int | None = Query(default=None),
    property_id: int | None = Query(default=None),
    open_only: bool = Query(default=False),
) -> list[ShowingRead]:
    query = Showing.objects()
    if lead_id is not None:
        query = query.where(Showing.lead == lead_id)
    if property_id is not None:
        query = query.where(Showing.property == property_id)
    if open_only:
        query = query.where(Showing.ended_at.is_null())
    rows = await query.order_by(Showing.started_at, ascending=False).run()
    return [_to_read(r) for r in rows]


@router.post("/{showing_id}/end", response_model=ShowingRead)
async def end_showing(showing_id: int) -> ShowingRead:
    showing = await Showing.objects().where(Showing.id == showing_id).first().run()
    if showing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="showing not found")
    if showing.ended_at is None:
        showing.ended_at = datetime.now(UTC)
        await showing.save().run()
    return _to_read(showing)
