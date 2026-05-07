from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from app.core.rate_limit import limiter
from app.models.models import User
from pydantic import BaseModel
from sqlalchemy import select
from typing import Optional

router = APIRouter()


class RegisterRequest(BaseModel):
    phone: str
    password: str


class LoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    is_member: bool


@router.post("/register", response_model=TokenResponse)
@limiter.limit("10/minute")
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if len(req.phone) < 11:
        raise HTTPException(status_code=400, detail="请输入有效的手机号")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")

    result = await db.execute(select(User).where(User.phone == req.phone))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="该手机号已注册")

    user = User(
        phone=req.phone,
        hashed_password=get_password_hash(req.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        is_member=user.is_member,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == req.phone))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        is_member=user.is_member,
    )
