from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.ai.scoring import score_lead
from app.schemas.ai import LeadScoreResponse

router = APIRouter(prefix="/leads", tags=["ai"])


@router.post("/{lead_id}/score", response_model=LeadScoreResponse)
async def score_lead_endpoint(lead_id: int) -> LeadScoreResponse:
    result = await score_lead(lead_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="lead not found")
    return result
