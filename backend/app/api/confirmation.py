from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.models import Project, LayoutResult, StoreProfile
from pydantic import BaseModel
from datetime import datetime
import re

router = APIRouter()


def mask_phone(phone: str) -> str:
    """
    手机号脱敏函数
    11 位手机号：138****1234
    其他长度：显示前 3 位和后 2 位
    """
    if not phone:
        return "未设置"
    
    phone_clean = re.sub(r'[^\d]', '', phone)
    
    if len(phone_clean) == 11:
        return re.sub(r'(\d{3})\d{4}(\d{4})', r'\1****\2', phone_clean)
    elif len(phone_clean) >= 5:
        return f"{phone_clean[:3]}***{phone_clean[-2:]}"
    else:
        return phone_clean


@router.post("/{project_id}")
async def create_confirmation(
    project_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        raise HTTPException(status_code=401, detail="未登录")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    layout_result = await db.execute(
        select(LayoutResult).where(LayoutResult.project_id == project_id).order_by(LayoutResult.created_at.desc())
    )
    layout = layout_result.scalar_one_or_none()

    store_result = await db.execute(select(StoreProfile).where(StoreProfile.user_id == user.id))
    store = store_result.scalar_one_or_none()

    store_info = None
    if user.is_member and store:
        store_info = {
            "store_name": store.store_name or "未设置",
            "phone": store.phone or "未设置",
            "address": store.address or "未设置",
            "logo_url": store.logo_url,
        }

    confirmation = {
        "project_name": project.name,
        "project_status": project.status,
        "show_price": project.show_price,
        "is_member": user.is_member,
        "tile_config": project.tile_config,
        "statistics": layout.statistics if layout else None,
        "store_info": store_info,
        "generated_at": str(datetime.utcnow()),
    }

    project.confirmation_data = confirmation
    await db.flush()

    return {
        "success": True,
        "data": {
            "token": f"confirm-{project_id[:8]}",
            "project_id": project_id,
            "generated_at": datetime.utcnow(),
            "data": confirmation,
        },
    }


@router.get("/{token}")
async def get_confirmation(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    pid = token.replace("confirm-", "")
    result = await db.execute(select(Project).where(Project.id.startswith(pid)))
    project = result.scalar_one_or_none()
    
    if project is None or project.confirmation_data is None:
        raise HTTPException(status_code=404, detail="确认单不存在")

    confirmation_data = project.confirmation_data.copy()
    
    if confirmation_data.get("store_info"):
        confirmation_data["store_info"] = confirmation_data["store_info"].copy()
        if confirmation_data["store_info"].get("phone"):
            confirmation_data["store_info"]["phone"] = mask_phone(
                confirmation_data["store_info"]["phone"]
            )

    return {
        "success": True,
        "data": confirmation_data,
    }
