from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.properties import PropertyRead

Bucket = Literal["hot", "warm", "cold"]
Confidence = Literal["high", "medium", "low"]


class ScoreComponents(BaseModel):
    completeness: int
    budget_realism: int
    engagement: int
    intent_clarity: int


class LeadScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lead_id: int
    score: int
    bucket: Bucket
    components: ScoreComponents
    reasoning_es: str
    next_action: str
    matching_inventory: int
    showings: int
    llm_used: bool


class MatchItem(BaseModel):
    property: PropertyRead
    fit_score: int
    why_es: str
    concerns_es: str | None = None


class MatchmakingResponse(BaseModel):
    lead_id: int
    matches: list[MatchItem]
    candidates_considered: int
    llm_used: bool


class ValuationResponse(BaseModel):
    property_id: int
    suggested_price_usd: Decimal
    range_low: Decimal
    range_high: Decimal
    current_price_usd: Decimal
    confidence: Confidence
    comps_count: int
    median_price_per_m2: Decimal | None
    narrative_es: str
    drivers: list[str]
    llm_used: bool
