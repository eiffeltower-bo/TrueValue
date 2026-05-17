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
        area_total_m2=prop.area_total_m2,
        area_construida_m2=prop.area_construida_m2,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        garages=prop.garages,
        floors=prop.floors,
        year_built=prop.year_built,
        listing_type=prop.listing_type,
        legal_status=prop.legal_status,
        utilities=prop.utilities or [],
        amenities=prop.amenities or [],
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
        area_total_m2=payload.area_total_m2,
        area_construida_m2=payload.area_construida_m2,
        bedrooms=payload.bedrooms,
        bathrooms=payload.bathrooms,
        garages=payload.garages,
        floors=payload.floors,
        year_built=payload.year_built,
        listing_type=payload.listing_type,
        legal_status=payload.legal_status,
        utilities=payload.utilities,
        amenities=payload.amenities,
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
    if payload.area_total_m2 is not None:
        prop.area_total_m2 = payload.area_total_m2
    if payload.area_construida_m2 is not None:
        prop.area_construida_m2 = payload.area_construida_m2
    if payload.bedrooms is not None:
        prop.bedrooms = payload.bedrooms
    if payload.bathrooms is not None:
        prop.bathrooms = payload.bathrooms
    if payload.garages is not None:
        prop.garages = payload.garages
    if payload.floors is not None:
        prop.floors = payload.floors
    if payload.year_built is not None:
        prop.year_built = payload.year_built
    if payload.listing_type is not None:
        prop.listing_type = payload.listing_type
    if payload.legal_status is not None:
        prop.legal_status = payload.legal_status
    if payload.utilities is not None:
        prop.utilities = payload.utilities
    if payload.amenities is not None:
        prop.amenities = payload.amenities
    await prop.save().run()
    return _to_read(prop)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(property_id: int) -> None:
    if not await Property.exists().where(Property.id == property_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="property not found")
    await Property.delete().where(Property.id == property_id).run()
