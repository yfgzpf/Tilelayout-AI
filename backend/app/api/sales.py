"""
销售计算 API

提供踢脚线计算、门头石计算、智能排版、通铺避让、完整报价单生成等功能
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Tuple, Optional, Dict
from app.services.skirting_calculator import SkirtingCalculator
from app.services.layout_optimizer import LayoutOptimizer
from app.services.door_optimizer import DoorOptimizer, DoorGap
from app.services.wall_avoidance import AutoAvoidWalls
from app.services.complete_quote import CompleteQuoteGenerator

router = APIRouter()


class SkirtingCalculateRequest(BaseModel):
    room_perimeter: float
    door_width: float
    tile_width: int
    tile_height: int
    skirting_height: int = 80
    tile_price: float = 50.0


class ThresholdCalculateRequest(BaseModel):
    doors: List[dict]
    material: str = 'marble'


class LayoutOptimizeRequest(BaseModel):
    room_area: float
    tile_width: int
    tile_height: int
    tile_price: float


class WallAvoidanceRequest(BaseModel):
    room_polygon: List[Tuple[float, float]]
    walls: List[List[Tuple[float, float]]]
    pillars: List[Tuple[float, float, float, float]]
    door_gaps: List[Tuple[float, float, float]]
    tile_width: float
    tile_height: float


class CompleteQuoteRequest(BaseModel):
    project_name: str
    area_sq_m: float
    tile_width_mm: int
    tile_height_mm: int
    gap_width_mm: float = 3.0
    tile_price: float = 50.0
    room_perimeter_mm: float = 0.0
    door_gaps: Optional[List[Dict]] = None
    include_waterproof: bool = False
    waterproof_area_sq_m: float = 0.0
    include_interface_agent: bool = False
    auxiliary_prices: Optional[Dict[str, float]] = None
    threshold_material: str = "marble"


@router.post("/skirting/calculate")
async def calculate_skirting(request: SkirtingCalculateRequest):
    """计算踢脚线用量和成本"""
    result = SkirtingCalculator.calculate_from_main_tile(
        room_perimeter=request.room_perimeter,
        door_width=request.door_width,
        tile_width=request.tile_width,
        tile_height=request.tile_height,
        skirting_height=request.skirting_height,
        tile_price=request.tile_price,
    )
    return {
        "success": True,
        "data": {
            "room_perimeter": result.room_perimeter,
            "door_width": result.door_width,
            "actual_length": result.actual_length,
            "skirting_height": result.skirting_height,
            "tiles_needed": result.tiles_needed,
            "pieces_per_tile": result.pieces_per_tile,
            "cost": result.cost,
            "waste_rate": result.waste_rate,
        },
    }


@router.post("/threshold/calculate")
async def calculate_threshold(request: ThresholdCalculateRequest):
    """计算门头石用量和成本"""
    doors = [
        DoorGap(
            id=d['id'],
            x=d['x'],
            y=d['y'],
            width=d['width'],
            type=d.get('type', 'entrance'),
        )
        for d in request.doors
    ]
    
    thresholds = DoorOptimizer.calculate_all_thresholds(doors, request.material)
    
    total_cost = sum(t.cost for t in thresholds)
    
    return {
        "success": True,
        "data": {
            "thresholds": [
                {
                    "door_id": t.door_id,
                    "length": t.length,
                    "width": t.width,
                    "material": t.material,
                    "cost": t.cost,
                }
                for t in thresholds
            ],
            "total_cost": total_cost,
        },
    }


@router.post("/layout/optimize")
async def optimize_layout(request: LayoutOptimizeRequest):
    """生成多种铺贴方案"""
    plans = LayoutOptimizer.generate_plans(
        room_area=request.room_area,
        tile_width=request.tile_width,
        tile_height=request.tile_height,
        tile_price=request.tile_price,
    )
    
    return {
        "success": True,
        "data": [
            {
                "plan_id": p.plan_id,
                "plan_name": p.plan_name,
                "layout_type": p.layout_type,
                "waste_rate": p.waste_rate,
                "tiles_needed": p.tiles_needed,
                "cost": p.cost,
                "beauty_score": p.beauty_score,
                "description": p.description,
            }
            for p in plans
        ],
    }


@router.post("/doors/optimize-start")
async def optimize_door_start_point(
    doors: List[dict],
    tile_width: int,
):
    """优化起铺点，规避门洞对缝"""
    door_gaps = [
        DoorGap(
            id=d['id'],
            x=d['x'],
            y=d.get('y', 0),
            width=d['width'],
            type=d.get('type', 'entrance'),
        )
        for d in doors
    ]
    
    result = DoorOptimizer.find_optimal_start_point(door_gaps, tile_width)
    
    return {
        "success": True,
        "data": {
            "offset": result.offset,
            "conflicts": result.conflicts,
            "details": result.details,
        },
    }


@router.post("/wall-avoidance/generate")
async def generate_wall_avoidance_layout(request: WallAvoidanceRequest):
    """生成避让墙体、柱子的铺贴方案"""
    result = AutoAvoidWalls.generate_layout_with_avoidance(
        room_polygon=request.room_polygon,
        walls=request.walls,
        pillars=request.pillars,
        door_gaps=request.door_gaps,
        tile_width=request.tile_width,
        tile_height=request.tile_height,
    )
    
    return {
        "success": True,
        "data": {
            "whole_tiles_count": len(result['whole_tiles']),
            "cut_tiles_count": len(result['cut_tiles']),
            "total_tiles": result['total_tiles'],
            "waste_rate": result['waste_rate'],
            "total_area": result['total_area'],
            "coverage_area": result['coverage_area'],
        },
    }


@router.post("/quote/complete")
async def generate_complete_quote(request: CompleteQuoteRequest):
    """生成完整报价单（整合主砖、踢脚线、门头石、辅料、防水涂料）"""
    quote = CompleteQuoteGenerator.generate_complete_quote(
        project_name=request.project_name,
        area_sq_m=request.area_sq_m,
        tile_width_mm=request.tile_width_mm,
        tile_height_mm=request.tile_height_mm,
        gap_width_mm=request.gap_width_mm,
        tile_price=request.tile_price,
        room_perimeter_mm=request.room_perimeter_mm,
        door_gaps=request.door_gaps,
        include_waterproof=request.include_waterproof,
        waterproof_area_sq_m=request.waterproof_area_sq_m,
        include_interface_agent=request.include_interface_agent,
        auxiliary_prices=request.auxiliary_prices,
        threshold_material=request.threshold_material,
    )
    
    return {
        "success": True,
        "data": quote.to_dict(),
    }
