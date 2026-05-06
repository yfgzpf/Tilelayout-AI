"""
排版计算引擎 — 纯 Python 数学实现（零外部几何依赖）

使用射线法、鞋带公式和 Sutherland-Hodgman 裁剪实现精确几何计算。
支持「缝对齐门中」的核心功能！
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def left(self) -> float:
        return self.x

    def right(self) -> float:
        return self.x + self.w

    def top(self) -> float:
        return self.y

    def bottom(self) -> float:
        return self.y + self.h

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


@dataclass
class DoorPosition:
    """
    门的位置标记
    - 定义门所在的边缘
    - 通过 edge_index + position_ratio (0~1) 确定门中心
    """
    edge_index: int  # 门所在的边索引（房间多边形的边）
    position_ratio: float = 0.5  # 门中心在边上的位置比例（0=起点，1=终点）


def _cross(v1: Point, v2: Point) -> float:
    return v1.x * v2.y - v1.y * v2.x


def _inside_edge(p: Point, edge_start: Point, edge_end: Point) -> bool:
    edge = Point(edge_end.x - edge_start.x, edge_end.y - edge_start.y)
    to_point = Point(p.x - edge_start.x, p.y - edge_start.y)
    return _cross(edge, to_point) >= 0


def _line_intersection(p1: Point, p2: Point, p3: Point, p4: Point) -> Point:
    denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x)
    if abs(denom) < 1e-12:
        return Point(p1.x, p1.y)
    t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom
    return Point(p1.x + t * (p2.x - p1.x), p1.y + t * (p2.y - p1.y))


def _clip_polygon_by_edge(subject: List[Point], edge_start: Point, edge_end: Point) -> List[Point]:
    if len(subject) == 0:
        return []
    output: List[Point] = []
    prev = subject[-1]
    for curr in subject:
        if _inside_edge(curr, edge_start, edge_end):
            if not _inside_edge(prev, edge_start, edge_end):
                output.append(_line_intersection(prev, curr, edge_start, edge_end))
            output.append(curr)
        elif _inside_edge(prev, edge_start, edge_end):
            output.append(_line_intersection(prev, curr, edge_start, edge_end))
        prev = curr
    return output


def clip_rect_by_polygon(rect: Rect, polygon: List[Point]) -> List[Point]:
    result = rect.corners()
    if len(polygon) < 3:
        return result
    for i in range(len(polygon)):
        edge_start = polygon[i]
        edge_end = polygon[(i + 1) % len(polygon)]
        result = _clip_polygon_by_edge(result, edge_start, edge_end)
    return result


def polygon_area(vertices: List[Point]) -> float:
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    min_x = min(p.x for p in polygon)
    min_y = min(p.y for p in polygon)
    max_x = max(p.x for p in polygon)
    max_y = max(p.y for p in polygon)
    return min_x, min_y, max_x, max_y


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


class LayoutEngine:
    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 0,
        direction: str = "horizontal",
        start_point: Tuple[float, float] = (0, 0),
        door_position: Optional[DoorPosition] = None,
        align_gap_to_door_center: bool = False,
    ):
        self._validate(room_polygon, tile_width, tile_height, gap_width, direction)
        self._room_raw = room_polygon
        self._room_pts = [Point(float(v[0]), float(v[1])) for v in room_polygon]
        self.tile_width = tile_width
        self.tile_height = tile_height
        self.gap_width = gap_width
        self.direction = direction
        self.start_point = start_point
        self.door_position = door_position
        self.align_gap_to_door_center = align_gap_to_door_center
        
        # 如果启用了对齐，计算正确的起铺点
        if self.align_gap_to_door_center and self.door_position:
            self.start_point = self._calculate_gap_aligned_start()

    def _get_door_center(self) -> Point:
        """
        计算门中心点坐标
        """
        idx = self.door_position.edge_index
        p1 = self._room_pts[idx]
        p2 = self._room_pts[(idx + 1) % len(self._room_pts)]
        ratio = self.door_position.position_ratio
        
        center_x = p1.x + (p2.x - p1.x) * ratio
        center_y = p1.y + (p2.y - p1.y) * ratio
        return Point(center_x, center_y)

    def _is_edge_vertical(self, p1: Point, p2: Point) -> bool:
        """
        判断边是否近似垂直（上下方向的边）
        """
        return abs(p1.x - p2.x) < 1e-6

    def _is_edge_horizontal(self, p1: Point, p2: Point) -> bool:
        """
        判断边是否近似水平（左右方向的边）
        """
        return abs(p1.y - p2.y) < 1e-6

    def _calculate_gap_aligned_start(self) -> Tuple[float, float]:
        """
        核心算法：计算起铺点，让瓷砖缝隙精确对齐门中心
        
        逻辑：
        - 如果门在垂直边 → 垂直缝对齐门（调整x方向起铺点）
        - 如果门在水平边 → 水平缝对齐门（调整y方向起铺点）
        """
        if not self.door_position:
            return (0, 0)
        
        min_x, min_y, max_x, max_y = polygon_bounds(self._room_pts)
        door_center = self._get_door_center()
        
        # 获取门所在的边
        idx = self.door_position.edge_index
        edge_p1 = self._room_pts[idx]
        edge_p2 = self._room_pts[(idx + 1) % len(self._room_pts)]
        
        tile_w_gap = self.tile_width + self.gap_width
        tile_h_gap = self.tile_height + self.gap_width
        
        start_x = min_x
        start_y = min_y
        
        if self._is_edge_vertical(edge_p1, edge_p2):
            # 垂直边 → 调整X方向，让垂直缝对齐门中心
            # 垂直缝位置：start_x, start_x + tile_w_gap, start_x + 2*tile_w_gap, ...
            # 找到一个缝位置 = door_center.x
            distance_to_door = door_center.x - min_x
            num_tiles = math.floor(distance_to_door / tile_w_gap)
            # 让第 num_tiles 个缝正好对齐门中心
            start_x = door_center.x - num_tiles * tile_w_gap
            
        elif self._is_edge_horizontal(edge_p1, edge_p2):
            # 水平边 → 调整Y方向，让水平缝对齐门中心
            distance_to_door = door_center.y - min_y
            num_tiles = math.floor(distance_to_door / tile_h_gap)
            start_y = door_center.y - num_tiles * tile_h_gap
            
        return (start_x, start_y)

    def _validate(self, polygon, tw, th, gap, direction):
        if len(polygon) < 3:
            raise ValueError("至少需要3个顶点")
        if tw <= 0 or th <= 0:
            raise ValueError("瓷砖尺寸必须大于0")
        if gap < 0:
            raise ValueError("留缝宽度不能为负数")
        if direction not in ("horizontal", "vertical", "diagonal"):
            raise ValueError("方向必须为 horizontal/vertical/diagonal")

    def _tile_intersects_room(self, rx: float, ry: float) -> Tuple[bool, bool, float, float]:
        rect = Rect(rx, ry, self.tile_width, self.tile_height)
        
        # 简单的相交判断 - 检查瓷砖中心点是否在房间内
        center_x = rx + self.tile_width / 2
        center_y = ry + self.tile_height / 2
        center_inside = point_in_polygon(Point(center_x, center_y), self._room_pts)
        
        if not center_inside:
            # 检查瓷砖任何顶点是否在房间内
            tile_corners = rect.corners()
            any_corner_inside = any(point_in_polygon(corner, self._room_pts) for corner in tile_corners)
            
            if not any_corner_inside:
                # 检查房间顶点是否在瓷砖内
                tile_min_x, tile_min_y = rx, ry
                tile_max_x, tile_max_y = rx + self.tile_width, ry + self.tile_height
                
                room_has_point_in_tile = False
                for pt in self._room_pts:
                    if (tile_min_x <= pt.x <= tile_max_x and tile_min_y <= pt.y <= tile_max_y):
                        room_has_point_in_tile = True
                        break
                
                if not room_has_point_in_tile:
                    return False, False, self.tile_width, self.tile_height
        
        # 现在检查是否需要切割
        clipped = clip_rect_by_polygon(rect, self._room_pts)
        clip_area = polygon_area(clipped) if len(clipped) >= 3 else 0
        
        tile_area = self.tile_width * self.tile_height
        is_cut = clip_area < tile_area * 0.999
        
        if is_cut and len(clipped) >= 3:
            bx, by, _, _ = polygon_bounds(clipped)
            actual_w = max(p.x for p in clipped) - min(p.x for p in clipped)
            actual_h = max(p.y for p in clipped) - min(p.y for p in clipped)
            return True, is_cut, min(actual_w, self.tile_width), min(actual_h, self.tile_height)
        
        return True, is_cut, self.tile_width, self.tile_height

    def calculate_layout(self) -> Dict[str, Any]:
        tiles: List[Dict] = []
        tile_id = 1
        min_x, min_y, max_x, max_y = polygon_bounds(self._room_pts)

        # 计算瓷砖网格参数
        tile_w_gap = self.tile_width + self.gap_width
        tile_h_gap = self.tile_height + self.gap_width
        
        # 处理起铺点 - 如果未指定，则从房间左上角开始
        start_x = self.start_point[0] if self.start_point else min_x
        start_y = self.start_point[1] if self.start_point else min_y
        
        # 计算需要覆盖整个房间的网格范围
        # 向左和向下扩展以确保覆盖整个房间
        offset_left = math.floor((min_x - start_x) / tile_w_gap) - 2
        offset_top = math.floor((min_y - start_y) / tile_h_gap) - 2
        
        # 向右和向上扩展
        offset_right = math.ceil((max_x - start_x) / tile_w_gap) + 2
        offset_bottom = math.ceil((max_y - start_y) / tile_h_gap) + 2
        
        # 遍历瓷砖
        for row_offset in range(offset_top, offset_bottom + 1):
            for col_offset in range(offset_left, offset_right + 1):
                tile_x = start_x + col_offset * tile_w_gap
                tile_y = start_y + row_offset * tile_h_gap
                
                hits, is_cut, actual_w, actual_h = self._tile_intersects_room(tile_x, tile_y)
                if hits:
                    tiles.append({
                        "id": str(tile_id),
                        "x": round(tile_x, 2),
                        "y": round(tile_y, 2),
                        "width": round(actual_w, 2),
                        "height": round(actual_h, 2),
                        "rotation": 0,
                        "is_cut": is_cut,
                    })
                    tile_id += 1

        stats = self._calc_stats(tiles)
        return {"tiles": tiles, "statistics": stats}

    def _calc_stats(self, tiles: List[Dict]) -> Dict[str, Any]:
        total = len(tiles)
        whole = sum(1 for t in tiles if not t["is_cut"])
        cut = total - whole
        room_area = polygon_area(self._room_pts)
        tile_sum = sum(t["width"] * t["height"] for t in tiles)
        waste = (abs(tile_sum - room_area) / max(tile_sum, room_area) * 100) if tile_sum > 0 else 0.0
        return {
            "total_tiles": total,
            "whole_tiles": whole,
            "cut_tiles": cut,
            "waste_percentage": round(waste, 2),
            "total_area_sq_mm": round(room_area, 2),
            "total_area_sq_m": round(room_area / 1_000_000, 4),
        }

    def optimize_layout(self) -> Dict[str, Any]:
        best: Dict[str, Any] = self.calculate_layout()
        best_waste = best["statistics"]["waste_percentage"]
        offsets = [
            (self.tile_width / 2, 0),
            (0, self.tile_height / 2),
            (self.tile_width / 2, self.tile_height / 2),
            (self.tile_width / 4, self.tile_height / 4),
        ]
        for ox, oy in offsets:
            self.start_point = (ox, oy)
            layout = self.calculate_layout()
            w = layout["statistics"]["waste_percentage"]
            if w < best_waste:
                best_waste = w
                best = layout
        return best


def calculate_tile_layout(
    room_polygon: List[List[float]],
    tile_width: float,
    tile_height: float,
    gap_width: float = 0,
    direction: str = "horizontal",
    start_point: Tuple[float, float] = (0, 0),
    door_position: Optional[Dict[str, Any]] = None,
    align_gap_to_door_center: bool = False,
    optimize: bool = False,
) -> Dict[str, Any]:
    # 构建 DoorPosition 对象
    door_pos_obj = None
    if door_position:
        door_pos_obj = DoorPosition(
            edge_index=door_position.get("edge_index", 0),
            position_ratio=door_position.get("position_ratio", 0.5)
        )
    
    engine = LayoutEngine(
        room_polygon=room_polygon,
        tile_width=tile_width,
        tile_height=tile_height,
        gap_width=gap_width,
        direction=direction,
        start_point=start_point,
        door_position=door_pos_obj,
        align_gap_to_door_center=align_gap_to_door_center,
    )
    if optimize:
        return engine.optimize_layout()
    return engine.calculate_layout()
"""
瓷砖排版核心计算"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y:"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h:"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon:"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < ("""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(p"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float ="""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v["""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        #"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.r"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self."""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(t"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            #"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts)"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h)."""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y,"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.t"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge:"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float ="""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap:"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) ->"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x -"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx ="""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx = abs(p2.x - p1.x)
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx = abs(p2.x - p1.x)
        edge_dy = abs(p2.y - p1.y)
        is_horizontal_edge"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx = abs(p2.x - p1.x)
        edge_dy = abs(p2.y - p1.y)
        is_horizontal_edge = edge_dx > edge_dy
        
        tile_w_gap = self.tile_w +"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx = abs(p2.x - p1.x)
        edge_dy = abs(p2.y - p1.y)
        is_horizontal_edge = edge_dx > edge_dy
        
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap
        
"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx = abs(p2.x - p1.x)
        edge_dy = abs(p2.y - p1.y)
        is_horizontal_edge = edge_dx > edge_dy
        
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap
        
        # 3. 计算起铺点，让缝对齐门中心
        if is_"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx = abs(p2.x - p1.x)
        edge_dy = abs(p2.y - p1.y)
        is_horizontal_edge = edge_dx > edge_dy
        
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap
        
        # 3. 计算起铺点，让缝对齐门中心
        if is_horizontal_edge:
            # 横向边：在 Y 方向对齐
            if align_g"""
瓷砖排版核心计算引擎 —— 聚焦核心功能：
1. 基础排版（起铺点）
2. 缝对齐门中（核心功能）
3. 损耗优化
"""
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float
    y: float

    def __iter__(self):
        return iter((self.x, self.y))


@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

    def corners(self) -> List[Point]:
        return [
            Point(self.x, self.y),
            Point(self.x + self.w, self.y),
            Point(self.x + self.w, self.y + self.h),
            Point(self.x, self.y + self.h),
        ]


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """射线法判断点是否在多边形内"""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        pi, pj = polygon[i], polygon[j]
        if ((pi.y > point.y) != (pj.y > point.y)) and (
            point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x
        ):
            inside = not inside
        j = i
    return inside


def polygon_area(vertices: List[Point]) -> float:
    """鞋带公式计算面积"""
    n = len(vertices)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i].x * vertices[j].y
        area -= vertices[j].x * vertices[i].y
    return abs(area) / 2.0


def polygon_bounds(polygon: List[Point]) -> Tuple[float, float, float, float]:
    xs = [p.x for p in polygon]
    ys = [p.y for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


class TileLayoutEngine:
    """瓷砖排版核心引擎"""

    def __init__(
        self,
        room_polygon: List[List[float]],
        tile_width: float,
        tile_height: float,
        gap_width: float = 2,
    ):
        self.room_pts = [Point(v[0], v[1]) for v in room_polygon]
        self.tile_w = tile_width
        self.tile_h = tile_height
        self.gap = gap_width

        # 房间边界
        self.rx_min, self.ry_min, self.rx_max, self.ry_max = polygon_bounds(self.room_pts)
        self.room_width = self.rx_max - self.rx_min
        self.room_height = self.ry_max - self.ry_min

    def _tile_coverage(self, tile_x: float, tile_y: float) -> Tuple[bool, float]:
        """
        检查瓷砖是否覆盖房间
        返回：(是否使用, 覆盖面积)
        """
        corners = Rect(tile_x, tile_y, self.tile_w, self.tile_h).corners()
        center = Point(tile_x + self.tile_w / 2, tile_y + self.tile_h / 2)
        
        # 快速检查：中心是否在房间内
        center_inside = point_in_polygon(center, self.room_pts)
        
        if not center_inside:
            # 检查瓷砖任意角落是否在房间内
            any_corner_inside = any(point_in_polygon(c, self.room_pts) for c in corners)
            if not any_corner_inside:
                return False, 0.0
        
        # 这里简化处理：只要瓷砖和房间有交集就保留
        # 实际生产可以用 Sutherland-Hodgman 精确计算
        return True, self.tile_w * self.tile_h

    def calculate_from_start_point(self, start_x: float, start_y: float) -> Dict[str, Any]:
        """从指定起铺点计算排版"""
        tiles: List[Dict] = []
        tile_id = 1
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap

        # 计算网格范围，确保覆盖整个房间
        min_grid_x = math.floor((self.rx_min - start_x) / tile_w_gap) - 5
        max_grid_x = math.ceil((self.rx_max - start_x) / tile_w_gap) + 5
        min_grid_y = math.floor((self.ry_min - start_y) / tile_h_gap) - 5
        max_grid_y = math.ceil((self.ry_max - start_y) / tile_h_gap) + 5

        for grid_y in range(min_grid_y, max_grid_y):
            for grid_x in range(min_grid_x, max_grid_x):
                x = start_x + grid_x * tile_w_gap
                y = start_y + grid_y * tile_h_gap
                
                used, area = self._tile_coverage(x, y)
                if used:
                    # 简单判断是否是切割砖
                    corners = Rect(x, y, self.tile_w, self.tile_h).corners()
                    all_inside = all(point_in_polygon(c, self.room_pts) for c in corners)
                    
                    tiles.append({
                        "id": tile_id,
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": self.tile_w,
                        "height": self.tile_h,
                        "is_cut": not all_inside,
                    })
                    tile_id += 1

        return self._package_result(tiles, start_x, start_y)

    def calculate_aligned_to_door(
        self,
        door_edge: Tuple[int, int],  # 门的边索引
        door_position_ratio: float = 0.5,  # 门在边上的位置比例
        align_gap: bool = True,  # True=缝对齐, False=砖中对齐
    ) -> Dict[str, Any]:
        """
        核心功能：缝对齐门中
        
        参数：
            door_edge: 门所在的边 (p1_idx, p2_idx)
            door_position_ratio: 门在边上的位置 (0-1)
            align_gap: True=缝对齐门中线, False=砖中线对齐门中线
        """
        p1 = self.room_pts[door_edge[0]]
        p2 = self.room_pts[door_edge[1]]
        
        # 1. 计算门中心点（根据比例）
        door_center_x = p1.x + (p2.x - p1.x) * door_position_ratio
        door_center_y = p1.y + (p2.y - p1.y) * door_position_ratio
        
        # 2. 判断是横向边还是纵向边
        edge_dx = abs(p2.x - p1.x)
        edge_dy = abs(p2.y - p1.y)
        is_horizontal_edge = edge_dx > edge_dy
        
        tile_w_gap = self.tile_w + self.gap
        tile_h_gap = self.tile_h + self.gap
        
        # 3. 计算起铺点，让缝对齐门中心
        if is_horizontal_edge:
            # 横向边：在 Y 方向对齐
            if align_gap:
                # 缝对齐门中线
                # 门的 Y 坐标应该