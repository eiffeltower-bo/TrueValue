from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

Presence = Literal["no target", "moving", "still", "moving+still"]


class MeasurementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: str
    room: str
    temperature: Decimal | None
    humidity: Decimal | None
    presence: Presence | str
    property_id: int
    created_at: datetime
