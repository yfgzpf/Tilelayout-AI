"""
门洞优化器

处理入户门不对缝、多门洞规避、门头石计算等功能
"""
from typing import List, Dict, Optional
from dataclasses import dataclass
import uuid


@dataclass
class DoorGap:
    id: str
    x: float
    y: float
    width: float
    type: str
    needs_threshold: bool = False


@dataclass
class ThresholdStone:
    door_id: str
    length: float
    width: float
    material: str
    cost: float


@dataclass
class StartPointOptimization:
    offset: float
    conflicts: int
    details: List[Dict]


class DoorOptimizer:
    """门洞优化器"""
    
    MATERIAL_PRICES = {
        'marble': 200,
        'granite': 150,
        'quartz': 250,
        'tile': 80,
    }
    
    @staticmethod
    def find_optimal_start_point(
        doors: List[DoorGap],
        tile_width: int,
    ) -> StartPointOptimization:
        """
        找到最优起铺点，使所有门洞都不对缝
        
        Args:
            doors: 门洞列表
            tile_width: 瓷砖宽度 (mm)
        
        Returns:
            优化结果
        """
        best_offset = 0.0
        min_conflicts = float('inf')
        best_details = []
        
        for offset in range(0, tile_width, 50):
            conflicts = 0
            details = []
            
            for door in doors:
                door_center = door.x + door.width / 2
                tile_position = (door_center + offset) % tile_width
                
                is_conflict = (
                    tile_position < 100 or 
                    tile_position > tile_width - 100
                )
                
                if is_conflict:
                    conflicts += 1
                
                details.append({
                    'door_id': door.id,
                    'door_center': door_center,
                    'tile_position': tile_position,
                    'is_conflict': is_conflict,
                })
            
            if conflicts < min_conflicts:
                min_conflicts = conflicts
                best_offset = float(offset)
                best_details = details
            
            if conflicts == 0:
                break
        
        return StartPointOptimization(
            offset=best_offset,
            conflicts=int(min_conflicts),
            details=best_details,
        )
    
    @staticmethod
    def calculate_threshold_stone(
        door: DoorGap,
        material: str = 'marble',
    ) -> ThresholdStone:
        """
        计算门头石
        
        Args:
            door: 门洞信息
            material: 石材类型
        
        Returns:
            门头石计算结果
        """
        threshold_length = door.width + 100
        threshold_width = 250
        
        price_per_meter = DoorOptimizer.MATERIAL_PRICES.get(material, 200)
        
        length_m = threshold_length / 1000
        cost = length_m * price_per_meter
        
        return ThresholdStone(
            door_id=door.id,
            length=threshold_length,
            width=threshold_width,
            material=material,
            cost=cost,
        )
    
    @staticmethod
    def calculate_all_thresholds(
        doors: List[DoorGap],
        material: str = 'marble',
    ) -> List[ThresholdStone]:
        """
        计算所有门洞的门头石
        
        注意：所有门洞都需要门头石，包括入户门、卫生间门、厨房门、阳台门
        
        Args:
            doors: 门洞列表
            material: 石材类型
        
        Returns:
            门头石列表
        """
        thresholds = []
        
        for door in doors:
            threshold = DoorOptimizer.calculate_threshold_stone(door, material)
            thresholds.append(threshold)
        
        return thresholds
