from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.permissions import get_current_user, require_member
from app.models.models import Order, OrderItem, Project, Product, ProductSKU, LayoutResult
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import secrets
from decimal import Decimal

router = APIRouter()


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    return phone[:3] + "****" + phone[-4:]


class OrderItemCreate(BaseModel):
    sku_id: str
    texture_id: str
    quantity_whole: int = Field(..., ge=0)
    quantity_cut: int = Field(..., ge=0)
    price_per_piece: float = Field(..., ge=0)


class OrderCreate(BaseModel):
    project_id: str
    customer_name: str = Field(..., min_length=1, max_length=100)
    customer_phone: str = Field(..., min_length=11, max_length=20)
    show_total_price: bool = False
    items: List[OrderItemCreate]


class OrderItemResponse(BaseModel):
    id: str
    sku_id: str
    texture_id: str
    quantity_whole: int
    quantity_cut: int
    price_per_piece: float


class OrderResponse(BaseModel):
    id: str
    project_id: str
    customer_name: str
    customer_phone: str
    status: str
    total_amount: float
    show_total_price: bool
    confirm_token: Optional[str]
    confirmed_at: Optional[datetime]
    items: List[OrderItemResponse] = []
    created_at: datetime


@router.post("/")
async def create_order(
    data: OrderCreate,
    user=Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    project_result = await db.execute(select(Project).where(Project.id == data.project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    total = Decimal("0")
    order = Order(
        project_id=data.project_id,
        store_user_id=user.id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        show_total_price=data.show_total_price and user.is_member,
        confirm_token=secrets.token_urlsafe(24),
    )
    db.add(order)
    await db.flush()

    items_data = []
    for item in data.items:
        price = Decimal(str(item.price_per_piece))
        qty = item.quantity_whole + item.quantity_cut
        total += price * qty

        order_item = OrderItem(
            order_id=order.id,
            sku_id=item.sku_id,
            texture_id=item.texture_id,
            quantity_whole=item.quantity_whole,
            quantity_cut=item.quantity_cut,
            price_per_piece=price,
        )
        db.add(order_item)
        items_data.append(OrderItemResponse(
            id=str(order_item.id), sku_id=item.sku_id,
            texture_id=item.texture_id,
            quantity_whole=item.quantity_whole,
            quantity_cut=item.quantity_cut,
            price_per_piece=float(price),
        ))

    order.total_amount = total
    await db.flush()
    await db.refresh(order)

    return {
        "success": True,
        "data": OrderResponse(
            id=str(order.id), project_id=data.project_id,
            customer_name=data.customer_name,
            customer_phone=data.customer_phone,
            status=order.status,
            total_amount=float(total),
            show_total_price=order.show_total_price,
            confirm_token=order.confirm_token,
            items=items_data,
            created_at=order.created_at,
        ),
    }


@router.get("/")
async def list_orders(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        return {"success": True, "data": [], "total": 0}
    result = await db.execute(
        select(Order).where(Order.store_user_id == user.id).order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    data = []
    for o in orders:
        items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == o.id))
        items = items_result.scalars().all()
        data.append(OrderResponse(
            id=str(o.id), project_id=str(o.project_id),
            customer_name=o.customer_name or "",
            customer_phone=o.customer_phone or "",
            status=o.status or "draft",
            total_amount=float(o.total_amount) if o.total_amount else 0,
            show_total_price=o.show_total_price,
            confirm_token=o.confirm_token,
            confirmed_at=o.confirmed_at,
            items=[OrderItemResponse(
                id=str(i.id), sku_id=str(i.sku_id), texture_id=str(i.texture_id),
                quantity_whole=i.quantity_whole, quantity_cut=i.quantity_cut,
                price_per_piece=float(i.price_per_piece),
            ) for i in items],
            created_at=o.created_at,
        ))
    return {"success": True, "data": data, "total": len(data)}


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.store_user_id != user.id:
        raise HTTPException(status_code=403, detail="无权访问此订单")

    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    items = items_result.scalars().all()

    return {
        "success": True,
        "data": OrderResponse(
            id=str(order.id), project_id=str(order.project_id),
            customer_name=order.customer_name or "",
            customer_phone=order.customer_phone or "",
            status=order.status or "draft",
            total_amount=float(order.total_amount) if order.total_amount else 0,
            show_total_price=order.show_total_price,
            confirm_token=order.confirm_token,
            confirmed_at=order.confirmed_at,
            items=[OrderItemResponse(
                id=str(i.id), sku_id=str(i.sku_id), texture_id=str(i.texture_id),
                quantity_whole=i.quantity_whole, quantity_cut=i.quantity_cut,
                price_per_piece=float(i.price_per_piece),
            ) for i in items],
            created_at=order.created_at,
        ),
    }


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    VALID_STATUSES = {"draft", "pending", "confirmed", "processing", "completed", "cancelled"}
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"无效状态，可选值: {VALID_STATUSES}")

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.store_user_id != user.id:
        raise HTTPException(status_code=403, detail="无权操作此订单")

    order.status = status
    if status == "confirmed":
        order.confirmed_at = datetime.utcnow()
    await db.flush()
    return {"success": True, "message": f"订单状态已更新为 {status}"}


@router.get("/{order_id}/public")
async def get_order_public(
    order_id: str,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.confirm_token == token)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="订单不存在或链接无效")

    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    items = items_result.scalars().all()

    return {
        "success": True,
        "data": {
            "id": str(order.id),
            "customer_name": order.customer_name,
            "customer_phone": _mask_phone(order.customer_phone) if order.customer_phone else None,
            "status": order.status,
            "total_amount": float(order.total_amount) if order.total_amount else 0,
            "show_total_price": order.show_total_price,
            "items": [{
                "id": str(i.id),
                "quantity_whole": i.quantity_whole,
                "quantity_cut": i.quantity_cut,
                "price_per_piece": float(i.price_per_piece) if order.show_total_price else None,
            } for i in items],
            "created_at": str(order.created_at),
        },
    }
