"""
智能排版优化服务

生成多种铺贴方案，支持工字铺、错缝铺、人字铺、菱形铺等
"""
from typing import List, Dict, Optional
from dataclasses import dataclass
import uuid


@dataclass
class LayoutPlan:
    plan_id: str
    plan_name: str
    layout_type: str
    waste_rate: float
    tiles_needed: int
    cost: float
    beauty_score: int
    description: str


class LayoutOptimizer:
    """排版优化器"""
    
    LAYOUT_TYPES = {
        "工字铺": {
            "waste_rate": 0.05,
            "beauty_score": 7,
            "description": "最常见铺贴方式，损耗低，性价比高",
        },
        "错缝铺": {
            "waste_rate": 0.08,
            "beauty_score": 8,
            "description": "简约现代，损耗适中，美观度高",
        },
        "人字铺": {
            "waste_rate": 0.12,
            "beauty_score": 9,
            "description": "高档铺贴方式，损耗较高，效果极佳",
        },
        "菱形铺": {
            "waste_rate": 0.15,
            "beauty_score": 10,
            "description": "最高档铺贴方式，损耗最高，效果最好",
        },
    }
    
    @staticmethod
    def generate_plans(
        room_area: float,
        tile_width: int,
        tile_height: int,
        tile_price: float,
        max_plans: int = 3,
    ) -> List[LayoutPlan]:
        """
        生成多种铺贴方案
        
        Args:
            room_area: 房间面积 (㎡)
            tile_width: 瓷砖宽度 (mm)
            tile_height: 瓷砖高度 (mm)
            tile_price: 瓷砖单价 (元/片)
            max_plans: 最大方案数量
        
        Returns:
            方案列表
        """
        tile_area = (tile_width * tile_height) / 1000000
        
        plans = []
        
        for layout_type, config in LayoutOptimizer.LAYOUT_TYPES.items():
            base_tiles = room_area / tile_area
            
            tiles_needed = int(base_tiles * (1 + config["waste_rate"])) + 1
            
            cost = tiles_needed * tile_price
            
            plan = LayoutPlan(
                plan_id=str(uuid.uuid4()),
                plan_name=f"{layout_type}方案",
                layout_type=layout_type,
                waste_rate=config["waste_rate"],
                tiles_needed=tiles_needed,
                cost=cost,
                beauty_score=config["beauty_score"],
                description=config["description"],
            )
            plans.append(plan)
        
        plans.sort(key=lambda p: p.cost)
        
        return plans[:max_plans]
    
    @staticmethod
    def optimize_door_position(
        door_x: float,
        door_width: float,
        tile_width: int,
    ) -> float:
        """
        优化入户门位置，避免瓷砖接缝在门正中
        
        Args:
            door_x: 门的 X 坐标 (mm)
            door_width: 门的宽度 (mm)
            tile_width: 瓷砖宽度 (mm)
        
        Returns:
            起铺点偏移量 (mm)
        """
        door_center = door_x + door_width / 2
        
        tile_position = door_center % tile_width
        
        if tile_position < 100 or tile_position > tile_width - 100:
            return tile_width / 2
        
        return 0.0
