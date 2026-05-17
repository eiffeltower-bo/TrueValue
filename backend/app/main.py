from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from piccolo_admin.endpoints import create_admin

from app.api.ai import router as ai_router
from app.api.crm import router as crm_router
from app.api.edge import router as edge_router
from app.settings import settings
from app.tables.properties import Property
from app.tables.sales import Sale
from app.tables.users import User
from app.tables.measurements import Measurement
from app.tables.visitor_events import VisitorEvent


def create_app() -> FastAPI:
    app = FastAPI(
        title="TrueValue CRM API",
        version="0.1.0",
        description="Proptech CRM backend — FastAPI + Piccolo ORM.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        return {
            "service": "truevalue-backend",
            "version": "0.1.0",
            "env": settings.app_env,
            "docs": "/docs",
            "admin": "/admin/",
        }

    app.include_router(crm_router, prefix="/api/v1")
    app.include_router(edge_router, prefix="/api/v1/edge", tags=["edge"])
    app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])

    admin = create_admin(
        tables=[User, Property, Sale, Measurement, VisitorEvent],
        auth_table=User,
        site_name="TrueValue Admin",
        production=False,
    )
    app.mount("/admin/", admin)

    return app


app = create_app()
