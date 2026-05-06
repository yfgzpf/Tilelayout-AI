from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.permissions import get_current_user, require_member
from app.models.models import Product, ProductSKU, StoreProfile
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

router = APIRouter()


class SKUCreate(BaseModel):
    size_x_mm: int = Field(..., ge=10, le=5000)
    size_y_mm: int = Field(..., ge=10, le=5000)
    unit_price: Optional[float] = Field(None, ge=0)
    unit: str = "片"
    stock: int = Field(0, ge=0)


class SKUResponse(BaseModel):
    id: str
    product_id: str
    size_x_mm: int
    size_y_mm: int
    unit_price: Optional[float]
    unit: str
    stock: int

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    image_url: Optional[str] = None
    texture_id: Optional[str] = None


class ProductResponse(BaseModel):
    id: str
    name: str
    image_url: Optional[str]
    texture_id: Optional[str]
    skus: List[SKUResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/")
async def list_products(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        return {"success": True, "data": [], "total": 0}
    result = await db.execute(
        select(Product).order_by(Product.created_at.desc())
    )
    products = result.scalars().all()
    data = []
    for p in products:
        sku_result = await db.execute(select(ProductSKU).where(ProductSKU.product_id == p.id))
        skus = sku_result.scalars().all()
        data.append(ProductResponse(
            id=str(p.id), name=p.name, image_url=p.image_url,
            texture_id=str(p.texture_id) if p.texture_id else None,
            skus=[SKUResponse(id=str(s.id), product_id=str(s.product_id),
                   size_x_mm=s.size_x_mm, size_y_mm=s.size_y_mm,
                   unit_price=float(s.unit_price) if s.unit_price else None,
                   unit=s.unit, stock=s.stock) for s in skus],
            created_at=p.created_at,
        ))
    return {"success": True, "data": data, "total": len(data)}


@router.post("/")
async def create_product(
    data: ProductCreate,
    user=Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    product = Product(
        store_id=user.id,
        name=data.name,
        image_url=data.image_url,
        texture_id=data.texture_id,
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return {
        "success": True,
        "data": ProductResponse(id=str(product.id), name=product.name, created_at=product.created_at),
    }


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="产品不存在")
    sku_result = await db.execute(select(ProductSKU).where(ProductSKU.product_id == product.id))
    skus = sku_result.scalars().all()
    return {
        "success": True,
        "data": ProductResponse(
            id=str(product.id), name=product.name,
            image_url=product.image_url,
            texture_id=str(product.texture_id) if product.texture_id else None,
            skus=[SKUResponse(id=str(s.id), product_id=str(s.product_id),
                   size_x_mm=s.size_x_mm, size_y_mm=s.size_y_mm,
                   unit_price=float(s.unit_price) if s.unit_price else None,
                   unit=s.unit, stock=s.stock) for s in skus],
            created_at=product.created_at,
        ),
    }


@router.post("/{product_id}/skus")
async def add_sku(
    product_id: str,
    data: SKUCreate,
    user=Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="产品不存在")

    sku = ProductSKU(
        product_id=product_id,
        size_x_mm=data.size_x_mm,
        size_y_mm=data.size_y_mm,
        unit_price=data.unit_price,
        unit=data.unit,
        stock=data.stock,
    )
    db.add(sku)
    await db.flush()
    await db.refresh(sku)
    return {
        "success": True,
        "data": SKUResponse(
            id=str(sku.id), product_id=str(sku.product_id),
            size_x_mm=sku.size_x_mm, size_y_mm=sku.size_y_mm,
            unit_price=float(sku.unit_price) if sku.unit_price else None,
            unit=sku.unit, stock=sku.stock,
        ),
    }


@router.put("/{product_id}/skus/{sku_id}")
async def update_sku(
    product_id: str,
    sku_id: str,
    data: SKUCreate,
    user=Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProductSKU).where(
        ProductSKU.id == sku_id, ProductSKU.product_id == product_id
    ))
    sku = result.scalar_one_or_none()
    if sku is None:
        raise HTTPException(status_code=404, detail="SKU不存在")

    sku.size_x_mm = data.size_x_mm
    sku.size_y_mm = data.size_y_mm
    sku.unit_price = data.unit_price
    sku.unit = data.unit
    sku.stock = data.stock
    await db.flush()
    return {"success": True, "message": "SKU已更新"}


@router.delete("/{product_id}/skus/{sku_id}")
async def delete_sku(
    product_id: str,
    sku_id: str,
    user=Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProductSKU).where(
        ProductSKU.id == sku_id, ProductSKU.product_id == product_id
    ))
    sku = result.scalar_one_or_none()
    if sku is None:
        raise HTTPException(status_code=404, detail="SKU不存在")
    await db.delete(sku)
    await db.flush()
    return {"success": True, "message": "SKU已删除"}


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    user=Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="产品不存在")
    await db.delete(product)
    await db.flush()
    return {"success": True, "message": "产品已删除"}
