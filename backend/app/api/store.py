"""
门店信息管理 API

提供门店信息的 CRUD 操作，仅限会员使用
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.permissions import get_current_user, require_member
from app.models.models import User, StoreProfile
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid
import os
import shutil

router = APIRouter()

UPLOAD_DIR = "uploads/store_logos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class StoreProfileCreate(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    qr_code_url: Optional[str] = None


class StoreProfileUpdate(BaseModel):
    store_name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    qr_code_url: Optional[str] = None


class StoreProfileResponse(BaseModel):
    user_id: str
    store_name: Optional[str]
    logo_url: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    qr_code_url: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/profile", response_model=StoreProfileResponse)
async def get_store_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的门店信息"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    
    result = await db.execute(
        select(StoreProfile).where(StoreProfile.user_id == user.id)
    )
    store = result.scalar_one_or_none()
    
    if store is None:
        return StoreProfileResponse(
            user_id=str(user.id),
            store_name=None,
            logo_url=None,
            phone=None,
            address=None,
            qr_code_url=None,
            updated_at=datetime.utcnow(),
        )
    
    return StoreProfileResponse(
        user_id=str(store.user_id),
        store_name=store.store_name,
        logo_url=store.logo_url,
        phone=store.phone,
        address=store.address,
        qr_code_url=store.qr_code_url,
        updated_at=store.updated_at,
    )


@router.post("/profile", response_model=StoreProfileResponse)
async def create_store_profile(
    data: StoreProfileCreate,
    user: User = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    """创建门店信息（仅会员）"""
    result = await db.execute(
        select(StoreProfile).where(StoreProfile.user_id == user.id)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="门店信息已存在，请使用更新接口")
    
    store = StoreProfile(
        user_id=user.id,
        store_name=data.store_name,
        phone=data.phone,
        address=data.address,
        qr_code_url=data.qr_code_url,
    )
    db.add(store)
    await db.flush()
    await db.refresh(store)
    
    return StoreProfileResponse(
        user_id=str(store.user_id),
        store_name=store.store_name,
        logo_url=store.logo_url,
        phone=store.phone,
        address=store.address,
        qr_code_url=store.qr_code_url,
        updated_at=store.updated_at,
    )


@router.put("/profile", response_model=StoreProfileResponse)
async def update_store_profile(
    data: StoreProfileUpdate,
    user: User = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    """更新门店信息（仅会员）"""
    result = await db.execute(
        select(StoreProfile).where(StoreProfile.user_id == user.id)
    )
    store = result.scalar_one_or_none()
    
    if store is None:
        store = StoreProfile(user_id=user.id)
        db.add(store)
    
    if data.store_name is not None:
        store.store_name = data.store_name
    if data.phone is not None:
        store.phone = data.phone
    if data.address is not None:
        store.address = data.address
    if data.qr_code_url is not None:
        store.qr_code_url = data.qr_code_url
    
    await db.flush()
    await db.refresh(store)
    
    return StoreProfileResponse(
        user_id=str(store.user_id),
        store_name=store.store_name,
        logo_url=store.logo_url,
        phone=store.phone,
        address=store.address,
        qr_code_url=store.qr_code_url,
        updated_at=store.updated_at,
    )


@router.post("/upload-logo")
async def upload_store_logo(
    file: UploadFile = File(...),
    user: User = Depends(require_member),
    db: AsyncSession = Depends(get_db),
):
    """上传门店 Logo（仅会员）"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")
    
    file_ext = os.path.splitext(file.filename or "logo.jpg")[1]
    filename = f"{user.id}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    logo_url = f"/uploads/store_logos/{filename}"
    
    result = await db.execute(
        select(StoreProfile).where(StoreProfile.user_id == user.id)
    )
    store = result.scalar_one_or_none()
    
    if store is None:
        store = StoreProfile(user_id=user.id, logo_url=logo_url)
        db.add(store)
    else:
        store.logo_url = logo_url
    
    await db.flush()
    
    return {
        "success": True,
        "data": {
            "logo_url": logo_url,
            "message": "Logo 上传成功",
        },
    }
