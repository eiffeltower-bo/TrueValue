from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.schemas.sales import SaleCreate, SaleRead, SaleUpdate
from app.tables.sales import Sale
from app.tables.users import User

router = APIRouter(prefix="/sales", tags=["sales"])


def _to_read(sale: Sale) -> SaleRead:
    return SaleRead(
        id=sale.id,
        product_or_service=sale.product_or_service,
        amount=sale.amount,
        payment_method=sale.payment_method,
        location=sale.location,
        sold_at=sale.sold_at,
        agent_id=sale.agent,
    )


async def _ensure_agent(agent_id: int) -> None:
    if not await User.exists().where(User.id == agent_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"agent {agent_id} not found"
        )


@router.post("", response_model=SaleRead, status_code=status.HTTP_201_CREATED)
async def create_sale(payload: SaleCreate) -> SaleRead:
    await _ensure_agent(payload.agent_id)
    sale = Sale(
        product_or_service=payload.product_or_service,
        amount=payload.amount,
        payment_method=payload.payment_method,
        location=payload.location,
        agent=payload.agent_id,
    )
    await sale.save().run()
    return _to_read(sale)


@router.get("", response_model=list[SaleRead])
async def list_sales() -> list[SaleRead]:
    rows = await Sale.objects().run()
    return [_to_read(r) for r in rows]


@router.get("/{sale_id}", response_model=SaleRead)
async def get_sale(sale_id: int) -> SaleRead:
    sale = await Sale.objects().where(Sale.id == sale_id).first().run()
    if sale is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sale not found")
    return _to_read(sale)


@router.patch("/{sale_id}", response_model=SaleRead)
async def update_sale(sale_id: int, payload: SaleUpdate) -> SaleRead:
    sale = await Sale.objects().where(Sale.id == sale_id).first().run()
    if sale is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sale not found")
    if payload.agent_id is not None:
        await _ensure_agent(payload.agent_id)
        sale.agent = payload.agent_id
    if payload.product_or_service is not None:
        sale.product_or_service = payload.product_or_service
    if payload.amount is not None:
        sale.amount = payload.amount
    if payload.payment_method is not None:
        sale.payment_method = payload.payment_method
    if payload.location is not None:
        sale.location = payload.location
    await sale.save().run()
    return _to_read(sale)


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sale(sale_id: int) -> None:
    if not await Sale.exists().where(Sale.id == sale_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sale not found")
    await Sale.delete().where(Sale.id == sale_id).run()
