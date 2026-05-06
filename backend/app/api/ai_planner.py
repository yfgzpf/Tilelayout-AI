from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
from app.services.ai_room_analyzer import (
    AIRoomAnalyzer, 
    AIWallExtractor, 
    MaterialCalculator,
    NLPProcessor
)

router = APIRouter(prefix="/api/ai", tags=["AI 规划师"])


class NLInstructionRequest(BaseModel):
    text: str
    polygon: List[List[float]]


class MaterialCalculateRequest(BaseModel):
    tile_width: float
    tile_height: float
    gap_width: float
    room_area: float
    tile_price: float = 0.0
    labor_price: float = 0.0


@router.post("/analyze-photo")
async def analyze_photo(file: UploadFile = File(...)):
    """
    上传户型照片，AI自动识别墙/门/窗
    """
    try:
        contents = await file.read()
        # 模拟AI处理
        result = AIWallExtractor.extract_from_image_async(contents)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/process-instruction")
async def process_nl_instruction(request: NLInstructionRequest):
    """
    自然语言处理：理解用户意图修改户型
    """
    try:
        result = NLPProcessor.process_instruction(request.text, request.polygon)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/calculate-materials")
async def calculate_materials(request: MaterialCalculateRequest):
    """
    AI 精准算料：计算主砖 + 所有辅料
    """
    try:
        result = MaterialCalculator.calculate_all_materials(
            request.tile_width,
            request.tile_height,
            request.gap_width,
            request.room_area,
            request.tile_price,
            request.labor_price
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"计算失败: {str(e)}")


@router.get("/suggest/{polygon}")
async def get_smart_suggestions(polygon: List[List[float]]):
    """
    获取AI智能建议列表
    """
    suggestions = []
    
    # 1. 门位置建议
    door_suggestions = AIRoomAnalyzer.suggest_doors(polygon)
    suggestions.extend([
        {
            "id": uuid.uuid4().hex,
            "type": "door_location",
            "title": "门位置建议",
            "content": s["reason"],
            "tag": "美学" if "长" in s["reason"] else "建议",
            "confidence": s["confidence"]
        }
        for s in door_suggestions
    ])
    
    # 2. 更多建议...
    suggestions.append({
        "id": uuid.uuid4().hex,
        "type": "tile_size",
        "title": "尺寸推荐",
        "content": "600*1200mm 更显大气，建议考虑",
        "tag": "效果",
        "confidence": 0.88
    })
    
    return {
        "suggestions": suggestions
    }
