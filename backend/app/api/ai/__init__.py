from __future__ import annotations

from fastapi import APIRouter

from app.api.ai.leads import router as leads_router
from app.api.ai.matchmaking import router as matchmaking_router
from app.api.ai.valuation import router as valuation_router

router = APIRouter()
router.include_router(leads_router)
router.include_router(matchmaking_router)
router.include_router(valuation_router)
