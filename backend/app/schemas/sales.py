from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SaleCreate(BaseModel):
    product_or_service: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., ge=0)
    payment_method: str = Field(..., min_length=1, max_length=32)
    location: str = Field(..., min_length=1, max_length=255)
    agent_id: int
    property_id: int | None = None


class SaleUpdate(BaseModel):
    product_or_service: str | None = Field(default=None, min_length=1, max_length=255)
    amount: Decimal | None = Field(default=None, ge=0)
    payment_method: str | None = Field(default=None, min_length=1, max_length=32)
    location: str | None = Field(default=None, min_length=1, max_length=255)
    agent_id: int | None = None
    property_id: int | None = None


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_or_service: str
    amount: Decimal
    payment_method: str
    location: str
    sold_at: datetime
    agent_id: int
    property_id: int | None
