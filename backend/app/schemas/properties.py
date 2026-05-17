from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ListingType = Literal["venta", "alquiler", "anticretico"]
LegalStatus = Literal["saneado", "en_tramite", "con_observaciones", "pendiente"]


class PropertyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0)
    property_type: str = Field(..., min_length=1, max_length=64)
    location: str = Field(..., min_length=1, max_length=255)
    agent_id: int

    area_total_m2: int | None = Field(default=None, ge=0)
    area_construida_m2: int | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    garages: int | None = Field(default=None, ge=0)
    floors: int | None = Field(default=None, ge=0)
    year_built: int | None = Field(default=None, ge=1800, le=2100)
    listing_type: ListingType = "venta"
    legal_status: LegalStatus | None = None
    utilities: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)


class PropertyUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    price: Decimal | None = Field(default=None, ge=0)
    property_type: str | None = Field(default=None, min_length=1, max_length=64)
    location: str | None = Field(default=None, min_length=1, max_length=255)
    agent_id: int | None = None

    area_total_m2: int | None = Field(default=None, ge=0)
    area_construida_m2: int | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    garages: int | None = Field(default=None, ge=0)
    floors: int | None = Field(default=None, ge=0)
    year_built: int | None = Field(default=None, ge=1800, le=2100)
    listing_type: ListingType | None = None
    legal_status: LegalStatus | None = None
    utilities: list[str] | None = None
    amenities: list[str] | None = None


class PropertyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    price: Decimal
    property_type: str
    location: str
    agent_id: int
    created_at: datetime

    area_total_m2: int | None
    area_construida_m2: int | None
    bedrooms: int | None
    bathrooms: int | None
    garages: int | None
    floors: int | None
    year_built: int | None
    listing_type: str
    legal_status: str | None
    utilities: list[str]
    amenities: list[str]
