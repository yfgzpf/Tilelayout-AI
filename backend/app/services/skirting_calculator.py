"""
踢脚线计算服务

支持从主砖切割踢脚线，计算用量和成本
"""
from typing import List, Optional
from dataclasses import dataclass
import math


@dataclass
class SkirtingResult:
    room_perimeter: float
    door_width: float
    actual_length: float
    skirting_height: int
    tiles_needed: int
    pieces_per_tile: int
    cost: float
    waste_rate: float


class SkirtingCalculator:
    """踢脚线计算器"""
    
    @staticmethod
    def calculate_from_main_tile(
        room_perimeter: float,
        door_width: float,
        tile_width: int,
        tile_height: int,
        skirting_height: int = 80,
        tile_price: float = 50.0,
        waste_rate: float = 0.05,
    ) -> SkirtingResult:
        """
        从主砖切割踢脚线
        
        Args:
            room_perimeter: 房间周长 (m)
            door_width: 门洞宽度 (m)
            tile_width: 瓷砖宽度 (mm)
            tile_height: 瓷砖高度 (mm)
            skirting_height: 踢脚线高度 (mm), 默认 80mm
            tile_price: 瓷砖单价 (元/片)
            waste_rate: 损耗率, 默认 5%
        
        Returns:
            踢脚线计算结果
        """
        actual_length = room_perimeter - door_width
        
        pieces_per_tile = tile_width // skirting_height
        
        skirting_length = tile_height / 1000
        
        total_skirting_length = actual_length
        tiles_needed_base = total_skirting_length / (skirting_length * pieces_per_tile)
        
        tiles_needed = math.ceil(tiles_needed_base * (1 + waste_rate))
        
        cost = tiles_needed * tile_price
        
        return SkirtingResult(
            room_perimeter=room_perimeter,
            door_width=door_width,
            actual_length=actual_length,
            skirting_height=skirting_height,
            tiles_needed=tiles_needed,
            pieces_per_tile=pieces_per_tile,
            cost=cost,
            waste_rate=waste_rate,
        )
    
    @staticmethod
    def calculate_room_perimeter(vertices: List[List[float]]) -> float:
        """
        计算房间周长
        
        Args:
            vertices: 顶点列表 [[x1, y1], [x2, y2], ...]
        
        Returns:
            周长 (m)
        """
        if len(vertices) < 2:
            return 0.0
        
        perimeter = 0.0
        for i in range(len(vertices)):
            x1, y1 = vertices[i]
            x2, y2 = vertices[(i + 1) % len(vertices)]
            distance = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            perimeter += distance
        
        return perimeter / 1000
