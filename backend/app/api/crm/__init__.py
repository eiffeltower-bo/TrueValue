from __future__ import annotations

from fastapi import APIRouter

from app.api.crm.leads import router as leads_router
from app.api.crm.measurements import router as measurements_router
from app.api.crm.properties import router as properties_router
from app.api.crm.sales import router as sales_router
from app.api.crm.showings import router as showings_router
from app.api.crm.stats import router as stats_router
from app.api.crm.users import router as users_router
from app.api.crm.visitor_events import router as visitor_events_router

router = APIRouter()
router.include_router(users_router)
router.include_router(properties_router)
router.include_router(sales_router)
router.include_router(stats_router)
router.include_router(measurements_router)
router.include_router(visitor_events_router)
router.include_router(leads_router)
router.include_router(showings_router)
