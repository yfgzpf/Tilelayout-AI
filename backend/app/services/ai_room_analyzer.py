"""
AI户型分析引擎
模拟真实场景的智能识别功能
"""
import math
import uuid
from typing import List, Dict, Any, Tuple, Optional


class AIPoint:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
    
    def distance_to(self, other: 'AIPoint') -> float:
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)
    
    def to_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)


class AIRoomAnalyzer:
    """AI户型分析服务 - 模拟真实视觉识别能力"""
    
    @staticmethod
    def auto_correct_polygon(points: List[List[float]]) -> List[List[float]]:
        """
        智能矫正多边形
        - 自动闭合
        - 自动吸附直角
        - 自动移除重复点
        """
        if len(points) < 3:
            return points
        
        corrected = []
        
        # 简化点
        for p in points:
            if len(corrected) == 0 or AIPoint(*p).distance_to(AIPoint(*corrected[-1])) > 10:
                corrected.append(p)
        
        # 尝试自动闭合
        if len(corrected) >= 3:
            first = AIPoint(*corrected[0])
            last = AIPoint(*corrected[-1])
            if first.distance_to(last) > 20:
                # 距离远，不闭合
                pass
            else:
                # 闭合
                corrected[-1] = corrected[0]
        
        # 智能找直角
        if len(corrected) == 4:
            return AIRoomAnalyzer.make_rectangle(corrected)
        
        return corrected
    
    @staticmethod
    def make_rectangle(points: List[List[float]]) -> List[List[float]]:
        """强制变成矩形"""
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        return [
            [min_x, min_y],
            [max_x, min_y],
            [max_x, max_y],
            [min_x, max_y]
        ]
    
    @staticmethod
    def suggest_doors(points: List[List[float]]) -> List[Dict]:
        """
        AI智能建议门的位置
        简单启发式：通常在长边中间，或根据预设
        """
        suggestions = []
        n = len(points)
        
        if n < 4:
            return suggestions
        
        # 找最长边作为门推荐位置
        longest_edge_idx = 0
        longest_length = 0
        
        for i in range(n):
            p1 = AIPoint(*points[i])
            p2 = AIPoint(*points[(i + 1) % n])
            length = p1.distance_to(p2)
            if length > longest_length:
                longest_length = length
                longest_edge_idx = i
        
        suggestions.append({
            "edge_index": longest_edge_idx,
            "confidence": 0.85,
            "reason": "该边最长，通常为主入口",
            "position_ratio": 0.5  # 在边中间
        })
        
        return suggestions


class AIWallExtractor:
    """
    模拟从照片提取墙线
    (实际生产会接真实CV模型)
    """
    
    @staticmethod
    def extract_from_image_async(image_data: bytes) -> Dict[str, Any]:
        """模拟CV识别过程"""
        # 这是模拟，实际会调用OpenCV/ML模型
        import time
        time.sleep(1.5)  # 模拟处理延迟
        
        # 默认返回一个矩形
        return {
            "success": True,
            "vertices": [
                [0, 0],
                [3600, 0],
                [3600, 4200],
                [0, 4200]
            ],
            "detected_elements": {
                "walls": 4,
                "doors": 1,
                "windows": 2
            },
            "confidence": 0.78
        }


class MaterialCalculator:
    """AI精准算料器"""
    
    @staticmethod
    def calculate_all_materials(
        tile_width: float,
        tile_height: float,
        gap_width: float,
        room_area: float,
        tile_price: float = 0.0,
        labor_price: float = 0.0
    ) -> Dict[str, Any]:
        """
        计算所有物料
        - 主砖
        - 瓷砖胶
        - 美缝剂
        - 十字卡
        - 水泥沙子
        """
        
        # 瓷砖数量
        tile_area_m2 = (tile_width * tile_height) / 1_000_000
        total_tiles = math.ceil(room_area / tile_area_m2 * 1.08)  # 8%损耗
        
        # 瓷砖胶 (5kg/㎡)
        adhesive_kg = math.ceil(room_area * 5)
        
        # 美缝剂 (估算，实际需算周长)
        gap_per_m2 = 3  # 估算，1㎡约3m缝
        total_gap_m = room_area * gap_per_m2
        caulk_tubes = math.ceil(total_gap_m / 30)  # 1支约打30m
        
        # 十字卡
        spacer_count = total_tiles  # 粗略估算
        
        # 水泥沙子
        cement_bags = math.ceil(room_area * 0.6)  # 0.6袋/㎡
        sand_cubic = round(room_area * 0.02, 2)  # 2cm厚
        
        # 价格计算
        total_tile_price = total_tiles * tile_price
        total_labor_cost = room_area * labor_price
        total_price = total_tile_price + total_labor_cost + (caulk_tubes * 25)  # 美缝剂25元/支
        
        return {
            "tiles": {
                "count": total_tiles,
                "waste": 8.0,
                "unit": "片"
            },
            "adhesive": {
                "count": adhesive_kg,
                "unit": "kg"
            },
            "caulk": {
                "count": caulk_tubes,
                "unit": "支"
            },
            "spacers": {
                "count": spacer_count,
                "unit": "颗"
            },
            "cement": {
                "count": cement_bags,
                "unit": "袋"
            },
            "sand": {
                "count": sand_cubic,
                "unit": "m³"
            },
            "price_summary": {
                "tiles": round(total_tile_price, 2),
                "labor": round(total_labor_cost, 2),
                "auxiliary": round(caulk_tubes * 25 + adhesive_kg * 2, 2),
                "total": round(total_price + caulk_tubes * 25 + adhesive_kg * 2, 2)
            }
        }


# --- 自然语言理解 (NLU) 模拟 ---
class NLPProcessor:
    """
    简单的自然语言处理器
    理解用户意图并执行
    """
    
    @staticmethod
    def process_instruction(text: str, current_polygon: List[List[float]]) -> Dict[str, Any]:
        text = text.lower()
        
        # 意图分类
        if "加宽" in text or "加大" in text or "宽" in text and "米" in text:
            return NLPProcessor._handle_resize(text, current_polygon, expand=True)
        
        if "缩" in text or "窄" in text:
            return NLPProcessor._handle_resize(text, current_polygon, expand=False)
        
        if "门" in text:
            return {
                "action": "add_door",
                "params": {},
                "message": "已标记门位置，请在图上选择"
            }
        
        if "矩形" in text or "长方形" in text or "规整" in text:
            return {
                "action": "regularize",
                "result": AIRoomAnalyzer.make_rectangle(current_polygon),
                "message": "已自动规整为矩形"
            }
        
        return {
            "action": "unknown",
            "message": "未理解，请说「加宽30cm」或「规整为矩形」"
        }
    
    @staticmethod
    def _handle_resize(text: str, polygon: List[List[float]], expand: bool) -> Dict[str, Any]:
        # 简单提取数字
        number = 0.0
        import re
        match = re.search(r'(\d+(\.\d+)?)', text)
        if match:
            number = float(match.group(1))
        
        # 识别单位
        factor = 1.0
        if "米" in text:
            factor = 1000
        elif "厘米" in text or "cm" in text:
            factor = 10
        
        delta = number * factor if expand else -number * factor
        
        # 简单处理：假设是矩形，均匀加宽
        min_x = min(p[0] for p in polygon)
        min_y = min(p[1] for p in polygon)
        max_x = max(p[0] for p in polygon)
        max_y = max(p[1] for p in polygon)
        
        new_polygon = [
            [min_x - delta, min_y - delta],
            [max_x + delta, min_y - delta],
            [max_x + delta, max_y + delta],
            [min_x - delta, max_y + delta]
        ]
        
        return {
            "action": "resize",
            "result": new_polygon,
            "message": f"已按您说的{'加宽' if expand else '缩小'}房间"
        }
