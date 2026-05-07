"""
手绘识别 API

上传手绘户型图, 返回 OpenCV 提取的轮廓 + OCR 数字
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from app.core.permissions import get_current_user
from app.core.rate_limit import limiter
from app.models.models import User

router = APIRouter()


class SketchResult(BaseModel):
    success: bool = True
    data: dict


@router.post("/recognize")
@limiter.limit("30/minute")
async def recognize_sketch(
    request: Request,
    file: UploadFile = File(...),
    fit_to_rectangle: bool = False,
    user: Optional[User] = Depends(get_current_user),
):
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    image_bytes = await file.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片不能超过20MB")

    try:
        from app.services.sketch_recognition import SketchRecognizer
        recognizer = SketchRecognizer()
    except ImportError as e:
        return {
            "success": False,
            "data": {
                "message": f"OpenCV未安装, 无法使用手绘识别: {e}",
                "polygons": [],
                "dimensions": [],
            },
        }

    try:
        result = recognizer.recognize(image_bytes, fit_to_rectangle=fit_to_rectangle)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")
