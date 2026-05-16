from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["agent", "admin"]

# Lightweight email format check. We intentionally do not use ``EmailStr`` /
# email-validator: it rejects special-use TLDs like ``.local`` / ``.test`` which
# are useful in dev. The frontend can add stricter validation if desired.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)
    email: str = Field(..., min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    role: Role = "agent"
    active: bool = True


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=6, max_length=128)
    email: str | None = Field(default=None, min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    role: Role | None = None
    active: bool | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    first_name: str | None
    last_name: str | None
    active: bool
    admin: bool
    superuser: bool
    role: Role
    last_login: datetime | None
    created_at: datetime
