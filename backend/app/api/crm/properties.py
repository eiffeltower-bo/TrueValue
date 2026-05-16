from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.schemas.properties import PropertyCreate, PropertyRead, PropertyUpdate
from app.tables.properties import Property
from app.tables.users import User

router = APIRouter(prefix="/properties", tags=["properties"])


def _to_read(prop: Property) -> PropertyRead:
    return PropertyRead(
        id=prop.id,
        title=prop.title,
        price=prop.price,
        property_type=prop.property_type,
        location=prop.location,
        agent_id=prop.agent,
        created_at=prop.created_at,
    )


async def _ensure_agent(agent_id: int) -> None:
    if not await User.exists().where(User.id == agent_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"agent {agent_id} not found"
        )


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
async def create_property(payload: PropertyCreate) -> PropertyRead:
    await _ensure_agent(payload.agent_id)
    prop = Property(
        title=payload.title,
        price=payload.price,
        property_type=payload.property_type,
        location=payload.location,
        agent=payload.agent_id,
    )
    await prop.save().run()
    return _to_read(prop)


@router.get("", response_model=list[PropertyRead])
async def list_properties() -> list[PropertyRead]:
    rows = await Property.objects().run()
    return [_to_read(r) for r in rows]


@router.get("/{property_id}", response_model=PropertyRead)
async def get_property(property_id: int) -> PropertyRead:
    prop = await Property.objects().where(Property.id == property_id).first().run()
    if prop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="property not found")
    return _to_read(prop)


@router.patch("/{property_id}", response_model=PropertyRead)
async def update_property(property_id: int, payload: PropertyUpdate) -> PropertyRead:
    prop = await Property.objects().where(Property.id == property_id).first().run()
    if prop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="property not found")
    if payload.agent_id is not None:
        await _ensure_agent(payload.agent_id)
        prop.agent = payload.agent_id
    if payload.title is not None:
        prop.title = payload.title
    if payload.price is not None:
        prop.price = payload.price
    if payload.property_type is not None:
        prop.property_type = payload.property_type
    if payload.location is not None:
        prop.location = payload.location
    await prop.save().run()
    return _to_read(prop)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(property_id: int) -> None:
    if not await Property.exists().where(Property.id == property_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="property not found")
    await Property.delete().where(Property.id == property_id).run()
