from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class EventType(str, Enum):
    IN = "in"
    OUT = "out"


class EventCreate(BaseModel):
    room: int = Field(..., ge=0)
    event: EventType = Field(...)
    timestamp: datetime = Field(default=None)
    property_id: int
