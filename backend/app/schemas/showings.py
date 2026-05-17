from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

ShowingSource = Literal["manual", "qr", "appointment"]


class ShowingCreate(BaseModel):
    lead_id: int
    property_id: int
    agent_id: int | None = None
    source: ShowingSource = "manual"


class ShowingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lead_id: int
    property_id: int
    agent_id: int | None
    started_at: datetime
    ended_at: datetime | None
    source: str
