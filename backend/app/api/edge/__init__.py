from __future__ import annotations

from fastapi import APIRouter

from app.api.edge.vision import router as vision_router

router = APIRouter()
router.include_router(vision_router)
