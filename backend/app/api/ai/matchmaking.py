from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.ai.matchmaking import match_lead
from app.schemas.ai import MatchmakingResponse

router = APIRouter(prefix="/leads", tags=["ai"])


@router.post("/{lead_id}/matches", response_model=MatchmakingResponse)
async def match_lead_endpoint(
    lead_id: int,
    limit: int = Query(default=5, ge=1, le=10),
) -> MatchmakingResponse:
    result = await match_lead(lead_id, limit=limit)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="lead not found")
    return result
