"""
辅料计算 API

涵盖验收标准 1.3 全部子项
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict
from app.services.auxiliary_material import AuxiliaryCalculator, AuxiliaryMaterials

router = APIRouter()


class MaterialCalcRequest(BaseModel):
    area_sq_m: float = Field(..., gt=0, le=10000, description="铺贴面积(m²)")
    tile_width_mm: float = Field(..., ge=50, le=3000, description="瓷砖宽度(mm)")
    tile_height_mm: float = Field(..., ge=50, le=3000, description="瓷砖高度(mm)")
    gap_width_mm: float = Field(2.0, ge=0, le=20, description="留缝宽度(mm)")
    total_tiles: int = Field(0, ge=0, description="总砖数(0=自动根据面积估算)")
    substrate_type: str = Field("normal", description="基层类型: smooth/normal/rough/uneven")
    method: str = Field("adhesive", description="铺贴方式: adhesive/cement/both")
    thickness_mm: float = Field(30.0, ge=10, le=100, description="水泥砂浆厚度(mm)")
    unit_prices: Optional[Dict[str, float]] = Field(None, description="辅料单价字典")


class MaterialCalcResponse(BaseModel):
    success: bool = True
    data: dict


@router.post("/calculate", response_model=MaterialCalcResponse)
async def calculate_auxiliary_materials(data: MaterialCalcRequest):
    prices = data.unit_prices or {}
    result = AuxiliaryCalculator.calculate_all(
        area_sq_m=data.area_sq_m,
        tile_width_mm=data.tile_width_mm,
        tile_height_mm=data.tile_height_mm,
        gap_width_mm=data.gap_width_mm,
        total_tiles=data.total_tiles,
        substrate_type=data.substrate_type,
        method=data.method,
        thickness_mm=data.thickness_mm,
        unit_prices=prices,
    )

    items = []
    for attr in ("adhesive", "cement_sand", "grout", "spacers"):
        obj = getattr(result, attr)
        if obj is None:
            continue
        d = {k: v for k, v in obj.__dict__.items() if v is not None}
        items.append(d)

    return {
        "success": True,
        "data": {
            "items": items,
            "cost_items": result.cost_items,
            "total_cost": result.total_cost,
            "method": data.method,
            "area_sq_m": data.area_sq_m,
        },
    }


@router.post("/adhesive")
async def calc_adhesive_only(data: MaterialCalcRequest):
    result = AuxiliaryCalculator.calc_adhesive(
        area_sq_m=data.area_sq_m,
        tile_width_mm=data.tile_width_mm,
        tile_height_mm=data.tile_height_mm,
        substrate_type=data.substrate_type,
    )
    return {
        "success": True,
        "data": {k: v for k, v in result.__dict__.items() if v is not None},
    }


@router.post("/grout")
async def calc_grout_only(data: MaterialCalcRequest):
    result = AuxiliaryCalculator.calc_grout(
        area_sq_m=data.area_sq_m,
        tile_width_mm=data.tile_width_mm,
        tile_height_mm=data.tile_height_mm,
        gap_width_mm=data.gap_width_mm,
        total_tiles=data.total_tiles,
    )
    return {
        "success": True,
        "data": {k: v for k, v in result.__dict__.items() if v is not None},
    }


@router.post("/cement-sand")
async def calc_cement_sand(data: MaterialCalcRequest):
    result = AuxiliaryCalculator.calc_cement_sand(
        area_sq_m=data.area_sq_m,
        thickness_mm=data.thickness_mm,
    )
    return {
        "success": True,
        "data": {k: v for k, v in result.__dict__.items() if v is not None},
    }


@router.post("/spacers")
async def calc_spacers(data: MaterialCalcRequest):
    tile_count = data.total_tiles if data.total_tiles > 0 else max(
        1, int(data.area_sq_m / (data.tile_width_mm / 1000.0 * data.tile_height_mm / 1000.0))
    )
    result = AuxiliaryCalculator.calc_spacers(total_tiles=tile_count)
    return {
        "success": True,
        "data": {k: v for k, v in result.__dict__.items() if v is not None},
    }


@router.get("/reference")
async def get_reference_data():
    return {
        "success": True,
        "data": {
            "adhesive_coefficients": AuxiliaryCalculator.ADHESIVE_COEFFICIENTS,
            "substrate_coefficients": AuxiliaryCalculator.SUBSTRATE_COEFFICIENTS,
            "grout_coverage_reference": AuxiliaryCalculator.GROUT_COVERAGE_REFERENCE,
            "tips": [
                "瓷砖胶用量与瓷砖规格正相关：小砖薄贴约3kg/m²，大砖厚贴约8kg/m²",
                "美缝剂用量参考：300x300砖约18m/支，800x800砖约10m/支",
                "水泥砂浆配合比建议1:3（水泥:砂），厚度通常30-50mm",
                "十字卡每片瓷砖约需4-6个，配合找平器使用效果更佳",
            ],
        },
    }
