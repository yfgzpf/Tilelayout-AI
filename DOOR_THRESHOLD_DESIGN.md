# 排砖宝 · 入户门不对缝与门头石功能设计

**设计时间**: 2026-05-06  
**业务场景**: 瓷砖通铺、多门洞规避、卫生间门头石  
**设计原则**: 符合瓷砖销售实际业务规则

---

## 一、入户门不对缝规则（重新设计）

### 1.1 业务规则理解

**核心规则**: 
- ✅ **通铺情况下**，瓷砖接缝不能在入户门正中间
- ✅ **多个门洞**，需要同时考虑所有门洞位置
- ✅ **自动调整起铺点**，确保所有门洞都不对缝

**错误理解**（之前）:
- ❌ 简单规避单个门洞
- ❌ 卫生间区域排除（实际需要门头石）

**正确理解**（现在）:
- ✅ 通铺情况下，考虑所有门洞位置
- ✅ 自动计算最优起铺点
- ✅ 卫生间需要门头石，不是排除区域

---

### 1.2 多门洞规避算法

**场景示例**:
```
户型: 客厅 + 餐厅 + 卧室（通铺）
门洞位置:
  - 入户门: x=0mm, 宽度=900mm
  - 卫生间门: x=3000mm, 宽度=800mm
  - 厨房门: x=6000mm, 宽度=700mm
  - 阳台门: x=9000mm, 宽度=1200mm

瓷砖规格: 800×800mm
目标: 找到最优起铺点，使所有门洞都不对缝
```

**算法逻辑**:
```python
def find_optimal_start_point(door_positions, tile_width):
    """
    找到最优起铺点，使所有门洞都不对缝
    
    Args:
        door_positions: 门洞位置列表 [{x, width}, ...]
        tile_width: 瓷砖宽度 (mm)
    
    Returns:
        最优起铺点偏移量 (mm)
    """
    # 遍历所有可能的起铺点偏移（0 到 tile_width）
    best_offset = 0
    min_conflicts = float('inf')
    
    for offset in range(0, tile_width, 50):  # 每50mm测试一次
        conflicts = 0
        
        for door in door_positions:
            door_center = door['x'] + door['width'] / 2
            
            # 计算门中心对应的瓷砖位置
            tile_position = (door_center + offset) % tile_width
            
            # 判断是否对缝（距离接缝小于100mm）
            if tile_position < 100 or tile_position > tile_width - 100:
                conflicts += 1
        
        # 如果冲突更少，更新最优偏移
        if conflicts < min_conflicts:
            min_conflicts = conflicts
            best_offset = offset
        
        # 如果没有冲突，直接返回
        if conflicts == 0:
            break
    
    return best_offset
```

**示例计算**:
```
瓷砖宽度: 800mm
门洞1: x=0, width=900, center=450
门洞2: x=3000, width=800, center=3400
门洞3: x=6000, width=700, center=6350

测试偏移量 offset=0:
  门洞1: (450 + 0) % 800 = 450mm (不对缝 ✅)
  门洞2: (3400 + 0) % 800 = 200mm (不对缝 ✅)
  门洞3: (6350 + 0) % 800 = 750mm (接近接缝 ⚠️)

测试偏移量 offset=400:
  门洞1: (450 + 400) % 800 = 650mm (不对缝 ✅)
  门洞2: (3400 + 400) % 800 = 600mm (不对缝 ✅)
  门洞3: (6350 + 400) % 800 = 350mm (不对缝 ✅)

最优起铺点: offset=400mm
```

---

### 1.3 前端实现

**界面设计**:
```
┌─────────────────────────────────────┐
│ 门洞管理                             │
├─────────────────────────────────────┤
│ ○ 入户门 (900mm)                    │
│   位置: x=0mm                       │
│   [规避对缝 ✅]                      │
│                                     │
│ ○ 卫生间门 (800mm)                  │
│   位置: x=3000mm                    │
│   [需要门头石 ✅]                    │
│                                     │
│ ○ 厨房门 (700mm)                    │
│   位置: x=6000mm                    │
│   [规避对缝 ✅]                      │
│                                     │
│ ○ 阳台门 (1200mm)                   │
│   位置: x=9000mm                    │
│   [规避对缝 ✅]                      │
│                                     │
│ [自动优化起铺点]                     │
│ 最优起铺点: x=400mm                 │
└─────────────────────────────────────┘
```

---

## 二、卫生间门头石功能（重新设计）

### 2.1 业务规则理解

**核心规则**:
- ✅ 卫生间与客厅之间需要**门头石**（过门石）
- ✅ 门头石通常是**不同材质或颜色**
- ✅ 需要单独计算门头石的用量和成本

**门头石规格**:
```
常见门头石规格:
  - 宽度: 与门洞宽度一致
  - 长度: 门洞宽度 + 100mm（两边各延伸50mm）
  - 厚度: 通常 15-20mm

材质选择:
  - 天然石材: 大理石、花岗岩
  - 人造石: 石英石、岩板
  - 瓷砖: 与主砖相同材质
```

**计算逻辑**:
```python
def calculate_threshold_stone(door_width, stone_type='marble'):
    """
    计算门头石用量和成本
    
    Args:
        door_width: 门洞宽度 (mm)
        stone_type: 石材类型 (marble/granite/quartz/tile)
    
    Returns:
        门头石计算结果
    """
    # 门头石长度 = 门洞宽度 + 100mm
    threshold_length = door_width + 100
    
    # 门头石宽度通常为 200-300mm
    threshold_width = 250
    
    # 根据石材类型计算价格
    prices = {
        'marble': 200,      # 大理石 200元/m
        'granite': 150,     # 花岗岩 150元/m
        'quartz': 250,      # 石英石 250元/m
        'tile': 80,         # 瓷砖 80元/m
    }
    
    # 计算用量（米）
    length_m = threshold_length / 1000
    
    # 计算成本
    cost = length_m * prices[stone_type]
    
    return {
        'length': threshold_length,
        'width': threshold_width,
        'length_m': length_m,
        'stone_type': stone_type,
        'cost': cost,
    }
```

**示例计算**:
```
卫生间门洞宽度: 800mm
选择石材: 大理石

门头石长度: 800 + 100 = 900mm
门头石宽度: 250mm
用量: 0.9m
成本: 0.9 × 200 = 180元
```

---

### 2.2 前端实现

**界面设计**:
```
┌─────────────────────────────────────┐
│ 门头石计算                           │
├─────────────────────────────────────┤
│ 门洞宽度: 800mm                      │
│                                     │
│ 石材类型:                           │
│ ○ 大理石 (200元/m) 推荐             │
│ ○ 花岗岩 (150元/m)                  │
│ ○ 石英石 (250元/m)                  │
│ ○ 瓷砖 (80元/m)                     │
│                                     │
│ 计算结果:                           │
│ 门头石长度: 900mm                   │
│ 门头石宽度: 250mm                   │
│ 用量: 0.9m                          │
│ 成本: ¥180                          │
│                                     │
│ [添加到报价单]                       │
└─────────────────────────────────────┘
```

---

## 三、完整业务流程

### 3.1 通铺场景流程

```
1. 用户绘制户型（包含多个门洞）
   ↓
2. 系统识别门洞位置
   ↓
3. 用户标记门洞类型:
   - 入户门: 需要规避对缝
   - 卫生间门: 需要门头石
   - 厨房门: 需要规避对缝
   - 阳台门: 需要规避对缝
   ↓
4. 系统自动计算:
   - 最优起铺点（规避所有门洞对缝）
   - 门头石用量和成本
   - 主砖用量和成本
   - 踢脚线用量和成本
   ↓
5. 生成完整报价单
```

---

### 3.2 数据结构设计

**门洞数据结构**:
```typescript
interface DoorGap {
  id: string;
  position: { x: number; y: number };
  width: number;
  type: 'entrance' | 'bathroom' | 'kitchen' | 'balcony';
  needsThreshold: boolean;  // 是否需要门头石
  thresholdStone?: {
    material: 'marble' | 'granite' | 'quartz' | 'tile';
    length: number;
    cost: number;
  };
}
```

**起铺点优化结果**:
```typescript
interface StartPointOptimization {
  offset: number;  // 起铺点偏移量 (mm)
  conflicts: number;  // 冲突门洞数量
  details: Array<{
    doorId: string;
    doorCenter: number;
    tilePosition: number;
    isConflict: boolean;
  }>;
}
```

---

## 四、技术实现

### 4.1 后端实现

**文件**: `backend/app/services/door_optimizer.py`

```python
from typing import List, Dict
from dataclasses import dataclass

@dataclass
class DoorGap:
    id: str
    x: float
    y: float
    width: float
    type: str  # entrance/bathroom/kitchen/balcony
    needs_threshold: bool = False

@dataclass
class ThresholdStone:
    door_id: str
    length: float
    width: float
    material: str
    cost: float

class DoorOptimizer:
    """门洞优化器"""
    
    @staticmethod
    def find_optimal_start_point(
        doors: List[DoorGap],
        tile_width: int,
    ) -> Dict:
        """
        找到最优起铺点，使所有门洞都不对缝
        
        Args:
            doors: 门洞列表
            tile_width: 瓷砖宽度 (mm)
        
        Returns:
            优化结果
        """
        best_offset = 0
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
                best_offset = offset
                best_details = details
            
            if conflicts == 0:
                break
        
        return {
            'offset': best_offset,
            'conflicts': min_conflicts,
            'details': best_details,
        }
    
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
        
        prices = {
            'marble': 200,
            'granite': 150,
            'quartz': 250,
            'tile': 80,
        }
        
        length_m = threshold_length / 1000
        cost = length_m * prices.get(material, 200)
        
        return ThresholdStone(
            door_id=door.id,
            length=threshold_length,
            width=threshold_width,
            material=material,
            cost=cost,
        )
```

---

### 4.2 API 端点设计

**文件**: `backend/app/api/doors.py`

```python
from fastapi import APIRouter, Depends
from app.services.door_optimizer import DoorOptimizer, DoorGap

router = APIRouter()

@router.post("/optimize-start-point")
async def optimize_start_point(
    doors: List[DoorGap],
    tile_width: int,
):
    """优化起铺点"""
    result = DoorOptimizer.find_optimal_start_point(doors, tile_width)
    return {"success": True, "data": result}

@router.post("/calculate-threshold")
async def calculate_threshold(
    door: DoorGap,
    material: str = 'marble',
):
    """计算门头石"""
    result = DoorOptimizer.calculate_threshold_stone(door, material)
    return {"success": True, "data": result}
```

---

## 五、总结

### 重新设计的核心改进

1. **入户门不对缝**:
   - ✅ 从单门洞规避 → 多门洞同时规避
   - ✅ 自动计算最优起铺点
   - ✅ 考虑通铺场景

2. **卫生间门头石**:
   - ✅ 从区域排除 → 门头石计算
   - ✅ 支持多种石材选择
   - ✅ 单独计算成本

3. **业务流程优化**:
   - ✅ 符合瓷砖销售实际业务
   - ✅ 提升专业度和信任度
   - ✅ 自动化计算，减少人工错误

---

**设计负责人**: AI 产品经理  
**设计日期**: 2026-05-06
