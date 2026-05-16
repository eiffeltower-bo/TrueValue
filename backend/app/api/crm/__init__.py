from __future__ import annotations

from fastapi import APIRouter

from app.api.crm.properties import router as properties_router
from app.api.crm.sales import router as sales_router
from app.api.crm.users import router as users_router

router = APIRouter()
router.include_router(users_router)
router.include_router(properties_router)
router.include_router(sales_router)
