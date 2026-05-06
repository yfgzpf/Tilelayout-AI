from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.permissions import get_current_user, require_member
from app.models.models import User, Texture
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os
import shutil
from datetime import datetime

router = APIRouter()

UPLOAD_DIR = "uploads/textures"


class TextureResponse(BaseModel):
    id: str
    name: str
    original_image_url: str
    processed_image_url: Optional[str] = None
    width_mm: Optional[int] = None
    height_mm: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TextureListResponse(BaseModel):
    success: bool = True
    data: List[TextureResponse]
    total: int


@router.get("/", response_model=TextureListResponse)
async def list_textures(
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        return {"success": True, "data": [], "total": 0}
    result = await db.execute(
        select(Texture).where(Texture.owner_id == user.id).order_by(Texture.created_at.desc())
    )
    textures = result.scalars().all()
    count = len(textures)
    return {
        "success": True,
        "data": [
            TextureResponse(
                id=str(t.id), name=t.name,
                original_image_url=t.original_image_url,
                processed_image_url=t.processed_image_url,
                width_mm=t.width_mm, height_mm=t.height_mm,
                created_at=t.created_at,
            ) for t in textures
        ],
        "total": count,
    }


@router.get("/{texture_id}")
async def get_texture(
    texture_id: str,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    result = await db.execute(select(Texture).where(Texture.id == texture_id, Texture.owner_id == user.id))
    texture = result.scalar_one_or_none()
    if texture is None:
        raise HTTPException(status_code=404, detail="纹理不存在")
    return {
        "success": True,
        "data": TextureResponse(
            id=str(texture.id), name=texture.name,
            original_image_url=texture.original_image_url,
            processed_image_url=texture.processed_image_url,
            width_mm=texture.width_mm, height_mm=texture.height_mm,
            created_at=texture.created_at,
        ),
    }


@router.post("/upload")
async def upload_texture(
    file: UploadFile = File(...),
    name: str = Form(...),
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    ext = os.path.splitext(file.filename or "image.png")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        raise HTTPException(status_code=400, detail="不支持的图片格式")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_id = uuid.uuid4()
    filename = f"{file_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f, length=1024 * 1024)

    texture = Texture(
        id=file_id,
        owner_id=user.id,
        name=name,
        original_image_url=f"/uploads/textures/{filename}",
    )
    db.add(texture)
    await db.flush()
    await db.refresh(texture)

    return {
        "success": True,
        "data": TextureResponse(
            id=str(texture.id), name=texture.name,
            original_image_url=texture.original_image_url,
            created_at=texture.created_at,
        ),
    }


@router.delete("/{texture_id}")
async def delete_texture(
    texture_id: str,
    user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    result = await db.execute(select(Texture).where(Texture.id == texture_id, Texture.owner_id == user.id))
    texture = result.scalar_one_or_none()
    if texture is None:
        raise HTTPException(status_code=404, detail="纹理不存在")

    filepath = texture.original_image_url.lstrip("/")
    if os.path.exists(filepath):
        os.remove(filepath)

    await db.delete(texture)
    await db.flush()
    return {"success": True, "message": "纹理已删除"}
