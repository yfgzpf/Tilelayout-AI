"""
管理员控制台 API

提供用户管理、订单管理、系统统计等管理功能
仅限超级管理员使用
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.models import User, Order, Project, StoreProfile
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta

router = APIRouter()

SUPER_ADMIN_PHONES = {"13800138000", "admin"}  # 超级管理员手机号列表


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    """要求超级管理员权限"""
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    if user.phone not in SUPER_ADMIN_PHONES:
        raise HTTPException(status_code=403, detail="无管理员权限")
    return user


class AdminUserResponse(BaseModel):
    id: str
    phone: str
    is_member: bool
    member_until: Optional[str]
    created_at: datetime
    project_count: int = 0
    order_count: int = 0

    class Config:
        from_attributes = True


class AdminOrderResponse(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    status: str
    total_amount: float
    created_at: datetime
    store_name: Optional[str] = None

    class Config:
        from_attributes = True


class AdminStatistics(BaseModel):
    total_users: int
    total_members: int
    total_projects: int
    total_orders: int
    today_new_users: int
    today_new_orders: int
    month_revenue: float


@router.get("/statistics", response_model=AdminStatistics)
async def get_admin_statistics(
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取系统统计数据"""
    total_users = await db.execute(select(func.count(User.id)))
    total_users = total_users.scalar() or 0
    
    total_members = await db.execute(
        select(func.count(User.id)).where(User.is_member == True)
    )
    total_members = total_members.scalar() or 0
    
    total_projects = await db.execute(select(func.count(Project.id)))
    total_projects = total_projects.scalar() or 0
    
    total_orders = await db.execute(select(func.count(Order.id)))
    total_orders = total_orders.scalar() or 0
    
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    today_new_users = await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )
    today_new_users = today_new_users.scalar() or 0
    
    today_new_orders = await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= today_start)
    )
    today_new_orders = today_new_orders.scalar() or 0
    
    month_start = datetime.combine(today.replace(day=1), datetime.min.time())
    month_orders = await db.execute(
        select(func.sum(Order.total_amount)).where(
            Order.created_at >= month_start,
            Order.status.in_(["confirmed", "processing", "completed"])
        )
    )
    month_revenue = float(month_orders.scalar() or 0)
    
    return AdminStatistics(
        total_users=total_users,
        total_members=total_members,
        total_projects=total_projects,
        total_orders=total_orders,
        today_new_users=today_new_users,
        today_new_orders=today_new_orders,
        month_revenue=month_revenue,
    )


@router.get("/users", response_model=List[AdminUserResponse])
async def list_all_users(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取所有用户列表"""
    query = select(User)
    
    if search:
        query = query.where(User.phone.contains(search))
    
    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    
    data = []
    for u in users:
        project_count = await db.execute(
            select(func.count(Project.id)).where(Project.user_id == u.id)
        )
        project_count = project_count.scalar() or 0
        
        order_count = await db.execute(
            select(func.count(Order.id)).where(Order.store_user_id == u.id)
        )
        order_count = order_count.scalar() or 0
        
        data.append(AdminUserResponse(
            id=str(u.id),
            phone=u.phone,
            is_member=u.is_member,
            member_until=str(u.member_until) if u.member_until else None,
            created_at=u.created_at,
            project_count=project_count,
            order_count=order_count,
        ))
    
    return data


@router.get("/orders", response_model=List[AdminOrderResponse])
async def list_all_orders(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取所有订单列表"""
    query = select(Order)
    
    if status:
        query = query.where(Order.status == status)
    
    query = query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().all()
    
    data = []
    for o in orders:
        store_result = await db.execute(
            select(StoreProfile).where(StoreProfile.user_id == o.store_user_id)
        )
        store = store_result.scalar_one_or_none()
        
        data.append(AdminOrderResponse(
            id=str(o.id),
            customer_name=o.customer_name or "",
            customer_phone=o.customer_phone or "",
            status=o.status or "draft",
            total_amount=float(o.total_amount) if o.total_amount else 0,
            created_at=o.created_at,
            store_name=store.store_name if store else None,
        ))
    
    return data


@router.put("/users/{user_id}/toggle-member")
async def toggle_user_member(
    user_id: str,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """切换用户会员状态"""
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    
    if target_user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    target_user.is_member = not target_user.is_member
    if target_user.is_member:
        target_user.member_until = datetime.utcnow() + timedelta(days=365)
    else:
        target_user.member_until = None
    
    await db.flush()
    
    return {
        "success": True,
        "message": f"用户会员状态已{'开启' if target_user.is_member else '关闭'}",
    }
