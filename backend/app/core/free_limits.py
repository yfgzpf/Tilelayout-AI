"""
免费用户使用次数限制

可配置的限制项：
- FREE_MONTHLY_PROJECTS: 每月创建项目数（默认3）
- FREE_MONTHLY_EXPORTS: 每月导出确认单数（默认3）
- FREE_TEXTURE_UPLOADS: 纹理上传总数（默认5）
- FREE_SKETCH_RECOGNITIONS: 每月手绘识别次数（默认5）
"""
from fastapi import HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.models import User, Project, Order, Texture
import os


class FreeLimitConfig:
    """免费限制配置"""
    
    MONTHLY_PROJECTS = int(os.getenv("FREE_MONTHLY_PROJECTS", "3"))
    MONTHLY_EXPORTS = int(os.getenv("FREE_MONTHLY_EXPORTS", "3"))
    TEXTURE_UPLOADS = int(os.getenv("FREE_TEXTURE_UPLOADS", "5"))
    MONTHLY_SKETCH_RECOGNITIONS = int(os.getenv("FREE_SKETCH_RECOGNITIONS", "5"))
    
    @classmethod
    def get_limits(cls):
        """获取所有限制配置"""
        return {
            "monthly_projects": cls.MONTHLY_PROJECTS,
            "monthly_exports": cls.MONTHLY_EXPORTS,
            "texture_uploads": cls.TEXTURE_UPLOADS,
            "monthly_sketch_recognitions": cls.MONTHLY_SKETCH_RECOGNITIONS,
        }


async def check_free_project_limit(
    request: Request,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """检查免费用户创建项目限制"""
    if user is None or user.is_member:
        return True

    monthly_limit = FreeLimitConfig.MONTHLY_PROJECTS
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.count(Project.id))
        .where(Project.user_id == user.id, Project.created_at >= month_start)
    )
    count = result.scalar() or 0

    if count >= monthly_limit:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "超出免费限制",
                "message": f"免费版每月限创建{monthly_limit}个项目，本月已用完。",
                "used": count,
                "limit": monthly_limit,
                "upgrade_url": "/upgrade",
            },
        )

    return {"used": count, "limit": monthly_limit, "remaining": monthly_limit - count}


async def check_free_export_limit(
    request: Request,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """检查免费用户导出确认单限制"""
    if user is None or user.is_member:
        return True

    monthly_limit = FreeLimitConfig.MONTHLY_EXPORTS
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.count(Order.id))
        .where(Order.store_user_id == user.id, Order.created_at >= month_start)
    )
    count = result.scalar() or 0

    if count >= monthly_limit:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "超出免费限制",
                "message": f"免费版每月限导出{monthly_limit}份确认单，本月已用完。",
                "used": count,
                "limit": monthly_limit,
                "upgrade_url": "/upgrade",
            },
        )

    return {"used": count, "limit": monthly_limit, "remaining": monthly_limit - count}


async def check_free_texture_limit(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """检查免费用户纹理上传限制"""
    if user is None or user.is_member:
        return True

    total_limit = FreeLimitConfig.TEXTURE_UPLOADS

    result = await db.execute(
        select(func.count(Texture.id))
        .where(Texture.owner_id == user.id)
    )
    count = result.scalar() or 0

    if count >= total_limit:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "超出免费限制",
                "message": f"免费版最多上传{total_limit}张纹理，已用完。",
                "used": count,
                "limit": total_limit,
                "upgrade_url": "/upgrade",
            },
        )

    return {"used": count, "limit": total_limit, "remaining": total_limit - count}


async def get_user_usage_stats(
    user: User,
    db: AsyncSession
) -> dict:
    """获取用户使用统计"""
    if user.is_member:
        return {
            "is_member": True,
            "limits": "unlimited",
            "usage": {},
        }

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    projects_result = await db.execute(
        select(func.count(Project.id))
        .where(Project.user_id == user.id, Project.created_at >= month_start)
    )
    projects_count = projects_result.scalar() or 0

    exports_result = await db.execute(
        select(func.count(Order.id))
        .where(Order.store_user_id == user.id, Order.created_at >= month_start)
    )
    exports_count = exports_result.scalar() or 0

    textures_result = await db.execute(
        select(func.count(Texture.id))
        .where(Texture.owner_id == user.id)
    )
    textures_count = textures_result.scalar() or 0

    return {
        "is_member": False,
        "limits": FreeLimitConfig.get_limits(),
        "usage": {
            "monthly_projects": {
                "used": projects_count,
                "limit": FreeLimitConfig.MONTHLY_PROJECTS,
                "remaining": max(0, FreeLimitConfig.MONTHLY_PROJECTS - projects_count),
            },
            "monthly_exports": {
                "used": exports_count,
                "limit": FreeLimitConfig.MONTHLY_EXPORTS,
                "remaining": max(0, FreeLimitConfig.MONTHLY_EXPORTS - exports_count),
            },
            "texture_uploads": {
                "used": textures_count,
                "limit": FreeLimitConfig.TEXTURE_UPLOADS,
                "remaining": max(0, FreeLimitConfig.TEXTURE_UPLOADS - textures_count),
            },
        },
    }
