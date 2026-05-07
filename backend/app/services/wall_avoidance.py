"""
通铺场景自动避让墙体算法

使用 Shapely 库实现多边形裁剪和碰撞检测
"""
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
import math


@dataclass
class Tile:
    x: float
    y: float
    width: float
    height: float
    tile_type: str  # whole 或 cut
    polygon: Optional[Polygon] = None


class AutoAvoidWalls:
    """自动避让墙体、柱子等障碍物"""
    
    @staticmethod
    def generate_layout_with_avoidance(
        room_polygon: List[Tuple[float, float]],
        walls: List[List[Tuple[float, float]]],
        pillars: List[Tuple[float, float, float, float]],
        door_gaps: List[Tuple[float, float, float]],
        tile_width: float,
        tile_height: float,
        start_point: Tuple[float, float] = (0, 0),
    ) -> Dict:
        """
        生成避让墙体、柱子、门洞的铺贴方案
        
        Args:
            room_polygon: 房间多边形顶点列表 [(x1, y1), (x2, y2), ...]
            walls: 墙体多边形列表
            pillars: 柱子列表 [(x, y, width, height), ...]
            door_gaps: 门洞列表 [(x, y, width), ...]
            tile_width: 瓷砖宽度 (mm)
            tile_height: 瓷砖高度 (mm)
            start_point: 起铺点坐标 (x, y)
        
        Returns:
            铺贴方案 {
                'whole_tiles': 整砖列表,
                'cut_tiles': 切割砖列表,
                'total_tiles': 总用量,
                'waste_rate': 损耗率,
                'total_area': 总面积,
                'coverage_area': 覆盖面积
            }
        """
        room = Polygon(room_polygon)
        
        obstacles = []
        
        for wall in walls:
            if len(wall) >= 3:
                obstacles.append(Polygon(wall))
        
        for pillar in pillars:
            x, y, w, h = pillar
            obstacles.append(box(x, y, x + w, y + h))
        
        for door in door_gaps:
            x, y, w = door
            door_thickness = 200  # 门洞厚度默认200mm
            obstacles.append(box(x, y, x + w, y + door_thickness))
        
        available_area = room
        for obstacle in obstacles:
            if obstacle.is_valid:
                available_area = available_area.difference(obstacle)
        
        tiles = []
        x = start_point[0]
        y = start_point[1]
        
        bounds = room.bounds
        x_max = bounds[2]
        y_max = bounds[3]
        
        while y < y_max:
            x = start_point[0]
            while x < x_max:
                tile_box = box(x, y, x + tile_width, y + tile_height)
                
                if not tile_box.intersects(available_area):
                    x += tile_width
                    continue
                
                intersection = tile_box.intersection(available_area)
                
                if intersection.is_empty:
                    pass
                elif intersection.equals(tile_box):
                    tiles.append(Tile(
                        x=x,
                        y=y,
                        width=tile_width,
                        height=tile_height,
                        tile_type='whole',
                        polygon=tile_box,
                    ))
                else:
                    tiles.append(Tile(
                        x=x,
                        y=y,
                        width=tile_width,
                        height=tile_height,
                        tile_type='cut',
                        polygon=intersection,
                    ))
                
                x += tile_width
            y += tile_height
        
        whole_tiles = [t for t in tiles if t.tile_type == 'whole']
        cut_tiles = [t for t in tiles if t.tile_type == 'cut']
        
        total_tiles = len(whole_tiles) + len(cut_tiles)
        waste_rate = len(cut_tiles) / total_tiles if total_tiles > 0 else 0
        
        total_area = room.area
        coverage_area = sum(t.polygon.area for t in tiles)
        
        return {
            'whole_tiles': whole_tiles,
            'cut_tiles': cut_tiles,
            'total_tiles': total_tiles,
            'waste_rate': waste_rate,
            'total_area': total_area,
            'coverage_area': coverage_area,
        }
    
    @staticmethod
    def optimize_start_point(
        room_polygon: List[Tuple[float, float]],
        walls: List[List[Tuple[float, float]]],
        pillars: List[Tuple[float, float, float, float]],
        door_gaps: List[Tuple[float, float, float]],
        tile_width: float,
        tile_height: float,
    ) -> Tuple[float, float]:
        """
        优化起铺点，减少切割砖数量
        
        Args:
            同 generate_layout_with_avoidance
        
        Returns:
            最优起铺点坐标 (x, y)
        """
        best_start = (0.0, 0.0)
        min_cut_tiles = float('inf')
        
        step_x = tile_width / 10
        step_y = tile_height / 10
        
        for offset_x in range(0, int(tile_width), int(step_x)):
            for offset_y in range(0, int(tile_height), int(step_y)):
                result = AutoAvoidWalls.generate_layout_with_avoidance(
                    room_polygon,
                    walls,
                    pillars,
                    door_gaps,
                    tile_width,
                    tile_height,
                    start_point=(float(offset_x), float(offset_y)),
                )
                
                if len(result['cut_tiles']) < min_cut_tiles:
                    min_cut_tiles = len(result['cut_tiles'])
                    best_start = (float(offset_x), float(offset_y))
                
                if min_cut_tiles == 0:
                    return best_start
        
        return best_start
