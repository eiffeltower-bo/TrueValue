from __future__ import annotations

from fastapi import APIRouter, status
from pydantic import BaseModel
from app.tables.measurements import Measurement

from app.api.edge.vision import router as vision_router

router = APIRouter()
router.include_router(vision_router)

# {"temperature":30.2, "humidity":20.8, "presence": "e"}

class MeasurementInput(BaseModel):
    temperature: float | None
    humidity: float | None
    presence: str 
    sensor_id: str
    property_id: int
    room: str

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_measurement(measurement:MeasurementInput) -> dict:
    print('hello post')
    print(measurement)
    meas = Measurement(
        temperature=measurement.temperature,
        humidity=measurement.humidity,
        presence=measurement.presence,
        sensor_id=measurement.sensor_id,
        property=measurement.property_id,
        room=measurement.room

    )
    await meas.save().run()
    return {'message':'hello'}

