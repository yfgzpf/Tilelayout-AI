"""
免费用户使用次数限制
"""
from fastapi import HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.models import User, Project, Order


async def check_free_limit(request: Request, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user is None or user.is_member:
        return True

    import os
    monthly_limit = int(os.getenv("FREE_MONTHLY_LIMIT", "3"))
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.count(Project.id))
        .where(Project.user_id == user.id, Project.created_at >= month_start)
    )
    count = result.scalar() or 0

    if count >= monthly_limit:
        raise HTTPException(
            status_code=403,
            detail=f"免费版每月限创建{monthly_limit}个项目，已用完。请升级会员继续使用。",
        )

    return True


async def check_free_export_limit(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user is None or user.is_member:
        return True

    import os
    monthly_limit = int(os.getenv("FREE_MONTHLY_LIMIT", "3"))
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.count(Order.id))
        .where(Order.store_user_id == user.id, Order.created_at >= month_start)
    )
    count = result.scalar() or 0

    if count >= monthly_limit:
        raise HTTPException(
            status_code=403,
            detail=f"免费版每月限导出{monthly_limit}次确认单，已用完。请升级会员继续使用。",
        )

    return True
