"""
项目 API - 完整实现

包含项目的 CRUD 操作和排版计算
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.permissions import get_current_user
from app.services.layout_engine import calculate_tile_layout
from app.models.models import Project, User, LayoutResult, Texture
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
import uuid

router = APIRouter()


class TileConfig(BaseModel):
    tile_width: float = Field(..., gt=0, le=3000)
    tile_height: float = Field(..., gt=0, le=3000)
    gap_width: float = Field(0, ge=0, le=50)
    direction: str = Field("horizontal", pattern="^(horizontal|vertical|diagonal)$")
    start_point: Tuple[float, float] = (0, 0)


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    room_polygon: List[List[float]] = []
    edges_annotated: Optional[List[dict]] = None
    tile_config: Optional[TileConfig] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    room_polygon: Optional[List[List[float]]] = None
    edges_annotated: Optional[List[dict]] = None
    tile_config: Optional[TileConfig] = None
    status: Optional[str] = None


class CalculateLayoutRequest(BaseModel):
    texture_id: Optional[str] = None
    room_polygon: Optional[List[List[float]]] = None
    config: Optional[TileConfig] = None
    optimize: bool = False
    door_position: Optional[Dict[str, Any]] = None  # {"edge_index": int, "position_ratio": float}
    align_gap_to_door_center: bool = False


class ProjectResponse(BaseModel):
    id: str
    name: str
    room_polygon: List[List[float]]
    edges_annotated: Optional[List[dict]]
    tile_config: Optional[Dict[str, Any]]
    status: str
    show_price: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LayoutResultResponse(BaseModel):
    id: str
    project_id: str
    texture_id: Optional[str]
    tiles: List[Dict[str, Any]]
    statistics: Dict[str, Any]
    preview_image_url: Optional[str]
    created_at: datetime


@router.get("/")
async def list_projects(
    skip: int = 0,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的项目列表"""
    result = await db.execute(
        select(Project)
        .where(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    projects = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "id": str(p.id),
                "name": p.name,
                "roomPolygon": p.room_polygon or [],
                "edgesAnnotated": p.edges_annotated,
                "tileConfig": p.tile_config,
                "status": p.status,
                "showPrice": p.show_price,
                "createdAt": p.created_at.isoformat(),
                "updatedAt": p.updated_at.isoformat(),
            }
            for p in projects
        ],
    }


@router.post("/")
async def create_project(
    project_data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新项目"""
    tile_config_dict = None
    if project_data.tile_config:
        tile_config_dict = {
            "tileWidth": project_data.tile_config.tile_width,
            "tileHeight": project_data.tile_config.tile_height,
            "gapWidth": project_data.tile_config.gap_width,
            "direction": project_data.tile_config.direction,
            "startPoint": list(project_data.tile_config.start_point),
        }
    
    project = Project(
        user_id=user.id,
        name=project_data.name,
        room_polygon=project_data.room_polygon,
        edges_annotated=project_data.edges_annotated,
        tile_config=tile_config_dict,
        status="draft",
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    return {
        "success": True,
        "data": {
            "id": str(project.id),
            "name": project.name,
            "roomPolygon": project.room_polygon or [],
            "edgesAnnotated": project.edges_annotated,
            "tileConfig": project.tile_config,
            "status": project.status,
            "showPrice": project.show_price,
            "createdAt": project.created_at.isoformat(),
            "updatedAt": project.updated_at.isoformat(),
        },
    }


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目详情"""
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    return {
        "success": True,
        "data": {
            "id": str(project.id),
            "name": project.name,
            "roomPolygon": project.room_polygon or [],
            "edgesAnnotated": project.edges_annotated,
            "tileConfig": project.tile_config,
            "status": project.status,
            "showPrice": project.show_price,
            "confirmationData": project.confirmation_data,
            "createdAt": project.created_at.isoformat(),
            "updatedAt": project.updated_at.isoformat(),
        },
    }


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新项目"""
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    update_data = project_data.model_dump(exclude_unset=True)
    
    if "name" in update_data:
        project.name = update_data["name"]
    if "room_polygon" in update_data:
        project.room_polygon = update_data["room_polygon"]
    if "edges_annotated" in update_data:
        project.edges_annotated = update_data["edges_annotated"]
    if "tile_config" in update_data and update_data["tile_config"]:
        tc = update_data["tile_config"]
        project.tile_config = {
            "tileWidth": tc.tile_width,
            "tileHeight": tc.tile_height,
            "gapWidth": tc.gap_width,
            "direction": tc.direction,
            "startPoint": list(tc.start_point),
        }
    if "status" in update_data:
        project.status = update_data["status"]
    
    await db.commit()
    await db.refresh(project)
    
    return {
        "success": True,
        "data": {
            "id": str(project.id),
            "name": project.name,
            "roomPolygon": project.room_polygon or [],
            "edgesAnnotated": project.edges_annotated,
            "tileConfig": project.tile_config,
            "status": project.status,
            "showPrice": project.show_price,
            "createdAt": project.created_at.isoformat(),
            "updatedAt": project.updated_at.isoformat(),
        },
    }


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除项目"""
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    await db.delete(project)
    await db.commit()
    
    return {"success": True, "data": {"message": f"项目 {project_id} 已删除"}}


@router.post("/calculate/demo")
async def calculate_layout_demo_endpoint(request: CalculateLayoutRequest):
    """演示模式下的排版计算，不需要认证"""
    if not request.config:
        raise HTTPException(status_code=400, detail="请提供瓷砖配置")
    
    room_polygon = request.room_polygon if (request.room_polygon and len(request.room_polygon) >= 3) else [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]
    
    try:
        layout_result = calculate_tile_layout(
            room_polygon=room_polygon,
            tile_width=request.config.tile_width,
            tile_height=request.config.tile_height,
            gap_width=request.config.gap_width,
            direction=request.config.direction,
            start_point=request.config.start_point,
            door_position=request.door_position,
            align_gap_to_door_center=request.align_gap_to_door_center,
            optimize=request.optimize,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"排版计算失败: {str(e)}")
    
    return {
        "success": True,
        "data": {
            "tiles": layout_result["tiles"],
            "statistics": layout_result["statistics"],
        }
    }


@router.post("/{project_id}/calculate")
async def calculate_layout_endpoint(
    project_id: str,
    request: CalculateLayoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """执行排版计算"""
    # 如果是演示模式，直接返回演示结果
    if project_id == 'demo':
        demo_result = await calculate_layout_demo_endpoint(request)
        return demo_result
    
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 使用请求中的房间数据，或者项目中保存的房间数据
    room_polygon = request.room_polygon if (request.room_polygon and len(request.room_polygon) >= 3) else project.room_polygon
    
    if not room_polygon or len(room_polygon) < 3:
        raise HTTPException(status_code=400, detail="户型轮廓至少需要3个顶点")
    
    tile_config = request.config
    if not tile_config and project.tile_config:
        tile_config = TileConfig(
            tile_width=project.tile_config.get("tileWidth", 800),
            tile_height=project.tile_config.get("tileHeight", 800),
            gap_width=project.tile_config.get("gapWidth", 0),
            direction=project.tile_config.get("direction", "horizontal"),
            start_point=tuple(project.tile_config.get("startPoint", [0, 0])),
        )
    
    if not tile_config:
        raise HTTPException(status_code=400, detail="请提供瓷砖配置")
    
    try:
        layout_result = calculate_tile_layout(
            room_polygon=room_polygon,
            tile_width=tile_config.tile_width,
            tile_height=tile_config.tile_height,
            gap_width=tile_config.gap_width,
            direction=tile_config.direction,
            start_point=tile_config.start_point,
            door_position=request.door_position,
            align_gap_to_door_center=request.align_gap_to_door_center,
            optimize=request.optimize,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"排版计算失败: {str(e)}")
    
    texture_id = None
    if request.texture_id:
        try:
            texture_id = uuid.UUID(request.texture_id)
        except ValueError:
            pass
    
    layout = LayoutResult(
        project_id=pid,
        texture_id=texture_id,
        tiles=layout_result["tiles"],
        statistics=layout_result["statistics"],
    )
    
    db.add(layout)
    await db.commit()
    await db.refresh(layout)
    
    return {
        "success": True,
        "data": {
            "id": str(layout.id),
            "projectId": str(layout.project_id),
            "textureId": str(layout.texture_id) if layout.texture_id else None,
            "tiles": layout.tiles,
            "statistics": layout.statistics,
            "createdAt": layout.created_at.isoformat(),
        },
    }


@router.get("/{project_id}/layout")
async def get_layout(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取最新排版结果"""
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    result = await db.execute(
        select(LayoutResult)
        .where(LayoutResult.project_id == pid)
        .order_by(LayoutResult.created_at.desc())
        .limit(1)
    )
    layout = result.scalar_one_or_none()
    
    if not layout:
        return {
            "success": True,
            "data": {
                "projectId": project_id,
                "tiles": [],
                "statistics": {},
            },
        }
    
    return {
        "success": True,
        "data": {
            "id": str(layout.id),
            "projectId": str(layout.project_id),
            "textureId": str(layout.texture_id) if layout.texture_id else None,
            "tiles": layout.tiles,
            "statistics": layout.statistics,
            "previewImageUrl": layout.preview_image_url,
            "createdAt": layout.created_at.isoformat(),
        },
    }


@router.put("/{project_id}/materials")
async def update_materials(
    project_id: str,
    materials_data: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新项目材料关联"""
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if "show_price" in materials_data:
        project.show_price = materials_data["show_price"]
    
    await db.commit()
    
    return {"success": True, "data": {"message": "材料信息已更新"}}


@router.get("/{project_id}/export/pdf")
async def export_pdf(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导出 PDF"""
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    return {
        "success": True,
        "data": {
            "message": "PDF 导出功能开发中",
            "downloadUrl": f"/api/v1/projects/{project_id}/export/pdf/download",
        },
    }


@router.get("/{project_id}/export/ppt")
async def export_ppt(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导出 PPT"""
    try:
        pid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的项目ID")
    
    return {
        "success": True,
        "data": {
            "message": "PPT 导出功能开发中",
            "downloadUrl": f"/api/v1/projects/{project_id}/export/ppt/download",
        },
    }
