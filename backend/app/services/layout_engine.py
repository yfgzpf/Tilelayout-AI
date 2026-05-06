"""
排版计算引擎 — 纯 Python 数学实现（零外部几何依赖）

使用射线法、鞋带公式和 Sutherland-Hodgman 裁剪实现精确几何计算。
"""
from typing import List, Dict, Any, Tuple
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
    ):
        self._validate(room_polygon, tile_width, tile_height, gap_width, direction)
        self._room_raw = room_polygon
        self._room_pts = [Point(float(v[0]), float(v[1])) for v in room_polygon]
        self.tile_width = tile_width
        self.tile_height = tile_height
        self.gap_width = gap_width
        self.direction = direction
        self.start_point = start_point

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
        clipped = clip_rect_by_polygon(rect, self._room_pts)
        if len(clipped) < 3:
            return False, False, self.tile_width, self.tile_height
        clip_area = polygon_area(clipped)
        if clip_area < 0.001:
            return False, False, self.tile_width, self.tile_height

        tile_area = self.tile_width * self.tile_height
        is_cut = abs(clip_area - tile_area) > 0.5
        bx, by, _, _ = polygon_bounds(clipped)
        actual_w = min(max(p.x for p in clipped) - min(p.x for p in clipped), self.tile_width)
        actual_h = min(max(p.y for p in clipped) - min(p.y for p in clipped), self.tile_height)
        return True, is_cut, actual_w, actual_h

    def calculate_layout(self) -> Dict[str, Any]:
        tiles: List[Dict] = []
        tile_id = 1
        min_x, min_y, max_x, max_y = polygon_bounds(self._room_pts)

        atw = self.tile_width + self.gap_width
        ath = self.tile_height + self.gap_width
        if self.direction == "vertical":
            atw, ath = ath, atw

        sx = self.start_point[0] if self.start_point[0] != 0 else min_x
        sy = self.start_point[1] if self.start_point[1] != 0 else min_y

        cols = int(math.ceil((max_x - min_x) / atw)) + 2
        rows = int(math.ceil((max_y - min_y) / ath)) + 2

        for row in range(-1, rows):
            for col in range(-1, cols):
                x = sx + col * atw
                y = sy + row * ath
                hits, is_cut, aw, ah = self._tile_intersects_room(x, y)
                if hits:
                    tiles.append({
                        "id": str(tile_id),
                        "x": round(x, 2),
                        "y": round(y, 2),
                        "width": round(aw, 2),
                        "height": round(ah, 2),
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
    optimize: bool = False,
) -> Dict[str, Any]:
    engine = LayoutEngine(
        room_polygon=room_polygon,
        tile_width=tile_width,
        tile_height=tile_height,
        gap_width=gap_width,
        direction=direction,
        start_point=start_point,
    )
    if optimize:
        return engine.optimize_layout()
    return engine.calculate_layout()
