from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LeadIntent = Literal["venta", "alquiler", "anticretico"]
LeadStatus = Literal["new", "contacted", "visiting", "negotiating", "closed", "lost"]
LeadSource = Literal["walk_in", "referral", "web", "open_house", "other"]


class LeadCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    source: LeadSource = "walk_in"

    agent_id: int | None = None
    status: LeadStatus = "new"

    intent: LeadIntent = "venta"
    budget_min_usd: Decimal | None = Field(default=None, ge=0)
    budget_max_usd: Decimal | None = Field(default=None, ge=0)
    zonas: list[str] = Field(default_factory=list)
    bedrooms_min: int | None = Field(default=None, ge=0)
    area_min_m2: int | None = Field(default=None, ge=0)
    must_haves: list[str] = Field(default_factory=list)
    notes: str = ""


class LeadUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    source: LeadSource | None = None

    agent_id: int | None = None
    status: LeadStatus | None = None

    intent: LeadIntent | None = None
    budget_min_usd: Decimal | None = Field(default=None, ge=0)
    budget_max_usd: Decimal | None = Field(default=None, ge=0)
    zonas: list[str] | None = None
    bedrooms_min: int | None = Field(default=None, ge=0)
    area_min_m2: int | None = Field(default=None, ge=0)
    must_haves: list[str] | None = None
    notes: str | None = None


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str | None
    email: str | None
    source: str

    agent_id: int | None
    status: str

    intent: str
    budget_min_usd: Decimal | None
    budget_max_usd: Decimal | None
    zonas: list[str]
    bedrooms_min: int | None
    area_min_m2: int | None
    must_haves: list[str]
    notes: str

    created_at: datetime
