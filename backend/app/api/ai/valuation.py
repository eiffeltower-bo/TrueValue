from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.ai.valuation import value_property
from app.schemas.ai import ValuationResponse

router = APIRouter(prefix="/properties", tags=["ai"])


@router.post("/{property_id}/valuation", response_model=ValuationResponse)
async def value_property_endpoint(property_id: int) -> ValuationResponse:
    result = await value_property(property_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="property not found")
    return result
