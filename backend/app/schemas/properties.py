from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PropertyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0)
    property_type: str = Field(..., min_length=1, max_length=64)
    location: str = Field(..., min_length=1, max_length=255)
    agent_id: int


class PropertyUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    price: Decimal | None = Field(default=None, ge=0)
    property_type: str | None = Field(default=None, min_length=1, max_length=64)
    location: str | None = Field(default=None, min_length=1, max_length=255)
    agent_id: int | None = None


class PropertyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    price: Decimal
    property_type: str
    location: str
    agent_id: int
    created_at: datetime
