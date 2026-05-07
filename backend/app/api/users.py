"""
用户中心 API

提供用户信息管理、密码修改、会员状态等功能
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import decode_access_token, get_password_hash, verify_password
from app.core.permissions import get_current_user
from app.models.models import User, Project, Order
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

router = APIRouter()


class UserResponse(BaseModel):
    id: str
    phone: str
    is_member: bool
    member_until: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    phone: Optional[str] = Field(None, min_length=11, max_length=20)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)


class UserStatistics(BaseModel):
    total_projects: int
    total_orders: int
    member_days_remaining: Optional[int] = None


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户信息"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    
    return UserResponse(
        id=str(user.id),
        phone=user.phone,
        is_member=user.is_member,
        member_until=str(user.member_until) if user.member_until else None,
        created_at=user.created_at,
    )


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户信息"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    
    if data.phone is not None:
        result = await db.execute(
            select(User).where(User.phone == data.phone, User.id != user.id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="该手机号已被使用")
        user.phone = data.phone
    
    await db.flush()
    await db.refresh(user)
    
    return UserResponse(
        id=str(user.id),
        phone=user.phone,
        is_member=user.is_member,
        member_until=str(user.member_until) if user.member_until else None,
        created_at=user.created_at,
    )


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改密码"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    
    if not verify_password(data.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="原密码错误")
    
    user.hashed_password = get_password_hash(data.new_password)
    await db.flush()
    
    return {"success": True, "message": "密码修改成功"}


@router.get("/statistics", response_model=UserStatistics)
async def get_user_statistics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户使用统计"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    
    projects_result = await db.execute(
        select(func.count(Project.id)).where(Project.user_id == user.id)
    )
    total_projects = projects_result.scalar() or 0
    
    orders_result = await db.execute(
        select(func.count(Order.id)).where(Order.store_user_id == user.id)
    )
    total_orders = orders_result.scalar() or 0
    
    member_days_remaining = None
    if user.is_member and user.member_until:
        delta = user.member_until - datetime.utcnow()
        member_days_remaining = max(0, delta.days)
    
    return UserStatistics(
        total_projects=total_projects,
        total_orders=total_orders,
        member_days_remaining=member_days_remaining,
    )
