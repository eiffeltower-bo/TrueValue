from __future__ import annotations

from fastapi import APIRouter

from app.schemas.measurements import MeasurementRead
from app.tables.measurements import Measurement

router = APIRouter(prefix="/measurements", tags=["measurements"])


@router.get("/latest", response_model=list[MeasurementRead])
async def latest_measurements(property_id: int) -> list[MeasurementRead]:
    """Return one row per `sensor_id` for the given property — the most recent
    reading. Empty list if the property has no sensors installed.
    """
    rows = await Measurement.raw(
        "SELECT DISTINCT ON (sensor_id) "
        "  id, sensor_id, room, temperature, humidity, presence, "
        "  property AS property_id, created_at "
        "FROM measurements "
        "WHERE property = {} "
        "ORDER BY sensor_id, created_at DESC",
        property_id,
    )
    return [MeasurementRead(**r) for r in rows]
