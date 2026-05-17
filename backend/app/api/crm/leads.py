from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.schemas.leads import LeadCreate, LeadRead, LeadUpdate
from app.tables.leads import Lead
from app.tables.users import User

router = APIRouter(prefix="/leads", tags=["leads"])


def _to_read(lead: Lead) -> LeadRead:
    return LeadRead(
        id=lead.id,
        full_name=lead.full_name,
        phone=lead.phone,
        email=lead.email,
        source=lead.source,
        agent_id=lead.agent or None,
        status=lead.status,
        intent=lead.intent,
        budget_min_usd=lead.budget_min_usd,
        budget_max_usd=lead.budget_max_usd,
        zonas=lead.zonas or [],
        bedrooms_min=lead.bedrooms_min,
        area_min_m2=lead.area_min_m2,
        must_haves=lead.must_haves or [],
        notes=lead.notes or "",
        created_at=lead.created_at,
    )


async def _ensure_agent(agent_id: int) -> None:
    if not await User.exists().where(User.id == agent_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"agent {agent_id} not found"
        )


@router.post("", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
async def create_lead(payload: LeadCreate) -> LeadRead:
    if payload.agent_id is not None:
        await _ensure_agent(payload.agent_id)
    lead = Lead(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        source=payload.source,
        agent=payload.agent_id,
        status=payload.status,
        intent=payload.intent,
        budget_min_usd=payload.budget_min_usd,
        budget_max_usd=payload.budget_max_usd,
        zonas=payload.zonas,
        bedrooms_min=payload.bedrooms_min,
        area_min_m2=payload.area_min_m2,
        must_haves=payload.must_haves,
        notes=payload.notes,
    )
    await lead.save().run()
    return _to_read(lead)


@router.get("", response_model=list[LeadRead])
async def list_leads() -> list[LeadRead]:
    rows = await Lead.objects().run()
    return [_to_read(r) for r in rows]


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(lead_id: int) -> LeadRead:
    lead = await Lead.objects().where(Lead.id == lead_id).first().run()
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="lead not found")
    return _to_read(lead)


@router.patch("/{lead_id}", response_model=LeadRead)
async def update_lead(lead_id: int, payload: LeadUpdate) -> LeadRead:
    lead = await Lead.objects().where(Lead.id == lead_id).first().run()
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="lead not found")
    if payload.agent_id is not None:
        await _ensure_agent(payload.agent_id)
        lead.agent = payload.agent_id
    if payload.full_name is not None:
        lead.full_name = payload.full_name
    if payload.phone is not None:
        lead.phone = payload.phone
    if payload.email is not None:
        lead.email = payload.email
    if payload.source is not None:
        lead.source = payload.source
    if payload.status is not None:
        lead.status = payload.status
    if payload.intent is not None:
        lead.intent = payload.intent
    if payload.budget_min_usd is not None:
        lead.budget_min_usd = payload.budget_min_usd
    if payload.budget_max_usd is not None:
        lead.budget_max_usd = payload.budget_max_usd
    if payload.zonas is not None:
        lead.zonas = payload.zonas
    if payload.bedrooms_min is not None:
        lead.bedrooms_min = payload.bedrooms_min
    if payload.area_min_m2 is not None:
        lead.area_min_m2 = payload.area_min_m2
    if payload.must_haves is not None:
        lead.must_haves = payload.must_haves
    if payload.notes is not None:
        lead.notes = payload.notes
    await lead.save().run()
    return _to_read(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: int) -> None:
    if not await Lead.exists().where(Lead.id == lead_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="lead not found")
    await Lead.delete().where(Lead.id == lead_id).run()
