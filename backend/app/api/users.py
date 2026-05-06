from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class UserResponse(BaseModel):
    id: str
    phone: str
    is_member: bool
    member_until: Optional[str] = None

    class Config:
        from_attributes = True


async def get_current_user_from_token(authorization: str, db: AsyncSession) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的认证令牌")
    token = authorization[len("Bearer "):]
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="认证令牌无效或已过期")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="认证令牌无效")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


@router.get("/me")
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token_data: dict = None,
):
    try:
        # 实际项目中应从Depends注入，此处为演示
        return {"message": "Get current user endpoint"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
