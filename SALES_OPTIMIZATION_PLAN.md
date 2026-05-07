# 排砖宝 · 瓷砖销售专业视角功能优化方案

**优化目标**: 提升销售效率、增强客户信任度、展现专业度  
**优化时间**: 2026-05-06  
**优化范围**: 智能排版、踢脚线计算、门洞处理、方案优化

---

## 一、瓷砖销售核心痛点分析

### 1.1 销售场景分析

**典型销售流程**:
```
客户进店 → 测量户型 → 选择瓷砖 → 计算用量 → 生成方案 → 报价 → 成交
   ↓           ↓           ↓           ↓           ↓       ↓      ↓
  1分钟      10分钟      5分钟       15分钟      20分钟   5分钟   ?
```

**核心痛点**:
1. ❌ **计算耗时长** - 手工计算用量、踢脚线、辅料，容易出错
2. ❌ **方案单一** - 只能提供一种铺贴方案，客户选择少
3. ❌ **专业度不足** - 无法快速给出专业建议（门洞规避、卫生间不通铺等）
4. ❌ **信任度低** - 客户怀疑计算准确性，担心浪费材料
5. ❌ **报价慢** - 需要人工计算总价，客户等待时间长

---

### 1.2 专业瓷砖销售的标准流程

**高效销售流程** (目标: 30分钟内完成):
```
客户进店 → 拍照/手绘 → AI识别 → 智能排版（3种方案）→ 自动报价 → 成交
   ↓           ↓          ↓           ↓                  ↓         ↓
  1分钟      2分钟      1分钟        3分钟              1分钟      ?
```

**关键提升**:
- ✅ **时间缩短 70%** - 从 56分钟 → 8分钟
- ✅ **方案多样化** - 提供 3 种铺贴方案
- ✅ **专业建议** - 自动规避门洞、卫生间不通铺
- ✅ **精准计算** - 包含主砖+踢脚线+辅料
- ✅ **可视化展示** - 客户直观看到效果

---

## 二、缺失功能详细分析

### 2.1 踢脚线计算功能 ❌ (P0 - 关键缺失)

**业务场景**:
- 客户选择 800×800 瓷砖
- 需要踢脚线（高度 6cm/8cm/10cm）
- **用当前瓷砖切割**，而不是单独购买踢脚线

**计算逻辑**:
```
房间周长 = (长 + 宽) × 2
踢脚线高度 = 8cm (常见规格)
单片瓷砖可切踢脚线数量 = 瓷砖宽度 / 踢脚线高度
  例如: 800mm / 80mm = 10 条
需要踢脚线总长度 = 周长 - 门洞宽度
需要瓷砖数量 = 需要踢脚线总长度 / (瓷砖长度 × 可切数量)
```

**示例计算**:
```
房间: 5m × 4m
周长: (5 + 4) × 2 = 18m
门洞: 0.9m
踢脚线高度: 8cm
瓷砖规格: 800×800mm

单片瓷砖可切: 800 / 80 = 10 条
每条长度: 800mm = 0.8m
需要踢脚线长度: 18 - 0.9 = 17.1m
需要瓷砖数量: 17.1 / (0.8 × 10) = 17.1 / 8 = 2.14 片
建议采购: 3 片 (含损耗)
```

**当前缺失**:
- ❌ 无踢脚线计算功能
- ❌ 无踢脚线规格选择（6cm/8cm/10cm）
- ❌ 无自动从主砖切割计算

---

### 2.2 智能排版优化 ❌ (P0 - 关键缺失)

**业务场景**:
- 同一个房间，可以有多种铺贴方案
- 客户希望看到不同方案的效果和成本
- 销售需要快速生成多种方案供选择

**常见铺贴方案**:
1. **工字铺** - 最常见，损耗率 5-8%
2. **人字铺** - 美观，损耗率 10-15%
3. **菱形铺** - 高档，损耗率 15-20%
4. **错缝铺** - 简约，损耗率 5-8%
5. **大砖通铺** - 现代，损耗率 3-5%

**智能优化需求**:
```
输入: 户型、瓷砖规格、预算
输出: 3种推荐方案
  - 方案1: 最省钱（损耗最低）
  - 方案2: 最美观（推荐方案）
  - 方案3: 最高档（损耗较高但效果好）
```

**当前缺失**:
- ❌ 只有一种排版方案
- ❌ 无多种铺贴方式选择
- ❌ 无方案对比功能
- ❌ 无损耗率优化

---

### 2.3 门洞/柱子自动识别与编辑 ❌ (P0 - 关键缺失)

**业务场景**:
- 门洞位置影响铺贴方案
- 入户门不能对缝（风水/美观）
- 柱子需要单独处理

**门洞处理规则**:
```
1. 入户门: 不能有瓷砖接缝在门正中
   → 自动调整起铺点，避开门中心
   
2. 卫生间门: 通常不通铺
   → 自动识别卫生间区域，排除铺贴
   
3. 厨房门: 可能需要过渡条
   → 自动添加过渡条计算
   
4. 阳台门: 可能需要不同材质
   → 提供材质切换建议
```

**柱子处理规则**:
```
1. 独立柱: 需要围绕柱子铺贴
   → 自动计算柱子周围的切割砖
   
2. 墙角柱: 需要特殊处理
   → 自动调整铺贴方向
   
3. 可移动柱子: 用户可调整位置
   → 支持拖拽、缩放、参数化输入
```

**当前缺失**:
- ❌ 无门洞自动识别
- ❌ 无入户门对缝规避
- ❌ 无柱子智能处理
- ❌ 门洞/柱子不支持二次编辑

---

### 2.4 卫生间区域排除 ❌ (P1 - 重要缺失)

**业务场景**:
- 卫生间通常使用不同瓷砖（防滑、小规格）
- 不与客厅/卧室通铺
- 需要自动识别并排除

**实现逻辑**:
```
1. 自动识别卫生间区域（通过户型图标注）
2. 排除卫生间区域的铺贴计算
3. 单独计算卫生间瓷砖用量
4. 生成卫生间独立报价
```

**当前缺失**:
- ❌ 无卫生间区域识别
- ❌ 无区域排除功能

---

### 2.5 房间周长自动计算 ⚠️ (P1 - 部分实现)

**业务场景**:
- 踢脚线计算需要房间周长
- 腻子、涂料计算也需要周长

**实现逻辑**:
```
周长 = Σ(各边长度)
  - 扣除门洞宽度
  - 扣除柜体遮挡部分
```

**当前状态**:
- ⚠️ 已有多边形顶点，可计算周长
- ❌ 未在界面展示
- ❌ 未用于踢脚线计算

---

## 三、专业销售视角的功能优化方案

### 3.1 一键智能方案生成（核心功能）

**功能描述**:
点击"智能排版"按钮，自动生成 3 种铺贴方案，包含：
- 方案对比（损耗率、成本、美观度）
- 3D 效果预览
- 一键选择

**实现步骤**:
```
1. 用户输入户型、选择瓷砖
2. 点击"智能排版"
3. 系统自动生成 3 种方案:
   - 方案A: 经济型（损耗 5%，成本最低）
   - 方案B: 推荐型（损耗 8%，性价比最高）
   - 方案C: 高端型（损耗 12%，效果最好）
4. 展示对比表格:
   | 方案 | 铺贴方式 | 损耗率 | 用量 | 成本 |
   |------|---------|--------|------|------|
   | A    | 工字铺  | 5%     | 50片 | ¥2500|
   | B    | 错缝铺  | 8%     | 52片 | ¥2600|
   | C    | 菱形铺  | 12%    | 55片 | ¥2750|
5. 用户选择方案，生成确认单
```

**技术实现**:
- 后端: 排版引擎支持多种铺贴方式
- 前端: 方案对比组件
- 算法: 遗传算法优化排版

---

### 3.2 踢脚线智能计算（关键功能）

**功能描述**:
自动计算踢脚线用量，支持：
- 从主砖切割（推荐）
- 单独购买踢脚线
- 多种高度选择（6cm/8cm/10cm）

**实现步骤**:
```
1. 自动计算房间周长
2. 扣除门洞、柜体宽度
3. 用户选择踢脚线高度
4. 计算可切割数量
5. 推荐最优方案:
   - 方案1: 从主砖切割（省钱）
   - 方案2: 购买成品踢脚线（省事）
6. 添加到报价单
```

**界面设计**:
```
┌─────────────────────────────────┐
│ 踢脚线计算                       │
├─────────────────────────────────┤
│ 房间周长: 18.0m                 │
│ 扣除门洞: -0.9m                 │
│ 实际长度: 17.1m                 │
│                                 │
│ 踢脚线高度: [6cm] [8cm] [10cm]  │
│                                 │
│ ○ 从主砖切割（推荐）             │
│   需要瓷砖: 3 片                │
│   成本: ¥150                    │
│                                 │
│ ○ 购买成品踢脚线                 │
│   需要数量: 18 根               │
│   成本: ¥360                    │
│                                 │
│ [添加到报价单]                   │
└─────────────────────────────────┘
```

---

### 3.3 门洞智能处理（专业功能）

**功能描述**:
- 自动识别门洞位置
- 入户门自动规避对缝
- 卫生间门自动排除区域

**实现步骤**:
```
1. 用户绘制门洞（已有功能）
2. 系统识别门洞类型:
   - 入户门 → 自动规避对缝
   - 卫生间门 → 排除铺贴区域
   - 厨房门 → 添加过渡条
3. 自动调整起铺点
4. 生成优化方案
```

**入户门规避算法**:
```python
def avoid_door_center(door_position, tile_width):
    """
    避免瓷砖接缝在门正中
    
    Args:
        door_position: 门的位置 (x坐标)
        tile_width: 瓷砖宽度
    
    Returns:
        起铺点偏移量
    """
    # 计算门中心是否在瓷砖接缝上
    door_center = door_position + door_width / 2
    
    # 如果在接缝上，调整起铺点
    if door_center % tile_width < 100:  # 距离接缝小于100mm
        offset = tile_width / 2  # 偏移半个瓷砖宽度
        return offset
    
    return 0
```

---

### 3.4 柱子智能处理（增强功能）

**功能描述**:
- 自动识别柱子
- 支持拖拽、缩放、参数化输入
- 自动计算柱子周围切割砖

**实现步骤**:
```
1. 用户绘制柱子（已有功能）
2. 系统识别柱子类型:
   - 独立柱 → 围绕铺贴
   - 墙角柱 → 特殊处理
3. 用户可调整柱子位置/尺寸
4. 自动重新计算排版
```

**界面设计**:
```
┌─────────────────────────────────┐
│ 柱子编辑                         │
├─────────────────────────────────┤
│ 位置 X: [2500] mm               │
│ 位置 Y: [1800] mm               │
│ 宽度: [400] mm                  │
│ 高度: [400] mm                  │
│                                 │
│ [拖拽调整] [参数输入]            │
└─────────────────────────────────┘
```

---

## 四、技术实现方案

### 4.1 后端实现

#### 4.1.1 踢脚线计算服务

**文件**: `backend/app/services/skirting_calculator.py`

```python
from typing import List, Dict
from dataclasses import dataclass

@dataclass
class SkirtingResult:
    room_perimeter: float  # 房间周长 (m)
    door_width: float  # 门洞宽度 (m)
    actual_length: float  # 实际长度 (m)
    skirting_height: int  # 踢脚线高度 (mm)
    tiles_needed: int  # 需要瓷砖数量
    cost: float  # 成本

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
    ) -> SkirtingResult:
        """
        从主砖切割踢脚线
        
        Args:
            room_perimeter: 房间周长 (m)
            door_width: 门洞宽度 (m)
            tile_width: 瓷砖宽度 (mm)
            tile_height: 瓷砖高度 (mm)
            skirting_height: 踢脚线高度 (mm)
            tile_price: 瓷砖单价 (元/片)
        
        Returns:
            踢脚线计算结果
        """
        # 计算实际长度
        actual_length = room_perimeter - door_width
        
        # 计算单片瓷砖可切数量
        pieces_per_tile = tile_width // skirting_height
        
        # 每条踢脚线长度
        skirting_length = tile_height / 1000  # mm → m
        
        # 需要瓷砖数量
        total_skirting_length = actual_length
        tiles_needed = total_skirting_length / (skirting_length * pieces_per_tile)
        tiles_needed = int(tiles_needed) + 1  # 向上取整
        
        # 计算成本
        cost = tiles_needed * tile_price
        
        return SkirtingResult(
            room_perimeter=room_perimeter,
            door_width=door_width,
            actual_length=actual_length,
            skirting_height=skirting_height,
            tiles_needed=tiles_needed,
            cost=cost,
        )
```

#### 4.1.2 智能排版优化服务

**文件**: `backend/app/services/layout_optimizer.py`

```python
from typing import List, Dict
from dataclasses import dataclass
import random

@dataclass
class LayoutPlan:
    plan_id: str
    plan_name: str
    layout_type: str  # 工字铺、人字铺、菱形铺等
    waste_rate: float  # 损耗率
    tiles_needed: int  # 需要瓷砖数量
    cost: float  # 成本
    beauty_score: int  # 美观度评分 (1-10)

class LayoutOptimizer:
    """排版优化器"""
    
    LAYOUT_TYPES = {
        "工字铺": {"waste_rate": 0.05, "beauty_score": 7},
        "错缝铺": {"waste_rate": 0.08, "beauty_score": 8},
        "人字铺": {"waste_rate": 0.12, "beauty_score": 9},
        "菱形铺": {"waste_rate": 0.15, "beauty_score": 10},
    }
    
    @staticmethod
    def generate_plans(
        room_area: float,
        tile_area: float,
        tile_price: float,
    ) -> List[LayoutPlan]:
        """
        生成多种铺贴方案
        
        Args:
            room_area: 房间面积 (㎡)
            tile_area: 瓷砖面积 (㎡)
            tile_price: 瓷砖单价 (元/片)
        
        Returns:
            方案列表
        """
        plans = []
        
        for layout_type, config in LayoutOptimizer.LAYOUT_TYPES.items():
            # 计算基础用量
            base_tiles = room_area / tile_area
            
            # 加上损耗
            tiles_needed = int(base_tiles * (1 + config["waste_rate"])) + 1
            
            # 计算成本
            cost = tiles_needed * tile_price
            
            # 生成方案
            plan = LayoutPlan(
                plan_id=f"plan_{random.randint(1000, 9999)}",
                plan_name=f"{layout_type}方案",
                layout_type=layout_type,
                waste_rate=config["waste_rate"],
                tiles_needed=tiles_needed,
                cost=cost,
                beauty_score=config["beauty_score"],
            )
            plans.append(plan)
        
        # 按成本排序
        plans.sort(key=lambda p: p.cost)
        
        return plans[:3]  # 返回前3个方案
```

---

### 4.2 前端实现

#### 4.2.1 踢脚线计算组件

**文件**: `packages/web/src/components/SkirtingCalculator.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Card, Radio, InputNumber, Button, Descriptions, message } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';

interface SkirtingCalculatorProps {
  roomPerimeter: number;
  doorWidth: number;
  tileWidth: number;
  tileHeight: number;
  tilePrice: number;
  onAddToQuote: (result: SkirtingResult) => void;
}

interface SkirtingResult {
  actualLength: number;
  skirtingHeight: number;
  tilesNeeded: number;
  cost: number;
}

const SkirtingCalculator: React.FC<SkirtingCalculatorProps> = ({
  roomPerimeter,
  doorWidth,
  tileWidth,
  tileHeight,
  tilePrice,
  onAddToQuote,
}) => {
  const [skirtingHeight, setSkirtingHeight] = useState(80);
  const [result, setResult] = useState<SkirtingResult | null>(null);

  const calculate = () => {
    const actualLength = roomPerimeter - doorWidth;
    const piecesPerTile = Math.floor(tileWidth / skirtingHeight);
    const skirtingLength = tileHeight / 1000;
    const tilesNeeded = Math.ceil(actualLength / (skirtingLength * piecesPerTile));
    const cost = tilesNeeded * tilePrice;

    setResult({
      actualLength,
      skirtingHeight,
      tilesNeeded,
      cost,
    });
  };

  useEffect(() => {
    calculate();
  }, [skirtingHeight]);

  return (
    <Card title={<><CalculatorOutlined /> 踢脚线计算</>}>
      <Descriptions column={1}>
        <Descriptions.Item label="房间周长">{roomPerimeter.toFixed(2)} m</Descriptions.Item>
        <Descriptions.Item label="扣除门洞">-{doorWidth.toFixed(2)} m</Descriptions.Item>
        <Descriptions.Item label="实际长度">{result?.actualLength.toFixed(2) || 0} m</Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 16 }}>
        <label>踢脚线高度：</label>
        <Radio.Group value={skirtingHeight} onChange={(e) => setSkirtingHeight(e.target.value)}>
          <Radio.Button value={60}>6 cm</Radio.Button>
          <Radio.Button value={80}>8 cm</Radio.Button>
          <Radio.Button value={100}>10 cm</Radio.Button>
        </Radio.Group>
      </div>

      {result && (
        <Card style={{ marginTop: 16, background: '#f5f5f5' }}>
          <Descriptions column={1}>
            <Descriptions.Item label="需要瓷砖">{result.tilesNeeded} 片</Descriptions.Item>
            <Descriptions.Item label="成本">¥{result.cost.toFixed(2)}</Descriptions.Item>
          </Descriptions>
          <Button type="primary" onClick={() => onAddToQuote(result)}>
            添加到报价单
          </Button>
        </Card>
      )}
    </Card>
  );
};

export default SkirtingCalculator;
```

#### 4.2.2 方案对比组件

**文件**: `packages/web/src/components/LayoutPlanComparison.tsx`

```typescript
import React from 'react';
import { Card, Table, Tag, Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

interface LayoutPlan {
  planId: string;
  planName: string;
  layoutType: string;
  wasteRate: number;
  tilesNeeded: number;
  cost: number;
  beautyScore: number;
}

interface LayoutPlanComparisonProps {
  plans: LayoutPlan[];
  onSelectPlan: (planId: string) => void;
}

const LayoutPlanComparison: React.FC<LayoutPlanComparisonProps> = ({
  plans,
  onSelectPlan,
}) => {
  const columns = [
    {
      title: '方案',
      dataIndex: 'planName',
      key: 'planName',
      render: (name: string, record: LayoutPlan) => (
        <>
          {name}
          {record.beautyScore >= 9 && <Tag color="gold" style={{ marginLeft: 8 }}>推荐</Tag>}
        </>
      ),
    },
    {
      title: '铺贴方式',
      dataIndex: 'layoutType',
      key: 'layoutType',
    },
    {
      title: '损耗率',
      dataIndex: 'wasteRate',
      key: 'wasteRate',
      render: (rate: number) => `${(rate * 100).toFixed(0)}%`,
    },
    {
      title: '用量',
      dataIndex: 'tilesNeeded',
      key: 'tilesNeeded',
      render: (count: number) => `${count} 片`,
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      render: (cost: number) => `¥${cost.toFixed(0)}`,
    },
    {
      title: '美观度',
      dataIndex: 'beautyScore',
      key: 'beautyScore',
      render: (score: number) => (
        <Tag color={score >= 9 ? 'green' : score >= 7 ? 'blue' : 'default'}>
          {score}/10
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: LayoutPlan) => (
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => onSelectPlan(record.planId)}
        >
          选择此方案
        </Button>
      ),
    },
  ];

  return (
    <Card title="智能排版方案对比">
      <Table
        columns={columns}
        dataSource={plans}
        rowKey="planId"
        pagination={false}
      />
    </Card>
  );
};

export default LayoutPlanComparison;
```

---

## 五、实施优先级

### P0 - 立即实施（本周完成）

1. ✅ **踢脚线计算功能**
   - 后端: SkirtingCalculator 服务
   - 前端: SkirtingCalculator 组件
   - API: POST /api/v1/skirting/calculate

2. ✅ **智能排版优化**
   - 后端: LayoutOptimizer 服务
   - 前端: LayoutPlanComparison 组件
   - API: POST /api/v1/layout/optimize

3. ✅ **房间周长自动计算**
   - 前端: 在户型编辑页显示周长
   - 后端: 计算接口

---

### P1 - 短期实施（下周完成）

1. ⚠️ **门洞智能处理**
   - 入户门对缝规避算法
   - 卫生间区域排除
   - 门洞类型识别

2. ⚠️ **柱子智能处理**
   - 柱子编辑功能增强
   - 参数化输入
   - 自动计算切割砖

---

### P2 - 长期规划（本月完成）

1. ⚠️ **卫生间区域识别**
   - AI 识别卫生间区域
   - 自动排除铺贴

2. ⚠️ **多种铺贴方式**
   - 人字铺、菱形铺等
   - 3D 效果预览

---

## 六、预期效果

### 6.1 销售效率提升

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 方案生成时间 | 20 分钟 | 3 分钟 | **85%** |
| 方案数量 | 1 种 | 3 种 | **200%** |
| 计算准确率 | 90% | 99% | **10%** |
| 客户等待时间 | 30 分钟 | 8 分钟 | **73%** |

---

### 6.2 客户体验提升

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 方案可视化 | ❌ 无 | ✅ 3D 预览 |
| 方案对比 | ❌ 无 | ✅ 表格对比 |
| 专业建议 | ❌ 无 | ✅ 自动生成 |
| 信任度 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

### 6.3 专业度提升

**优化前**:
- ❌ 只能提供一种方案
- ❌ 手工计算容易出错
- ❌ 无专业建议

**优化后**:
- ✅ 提供 3 种优化方案
- ✅ 自动计算，准确率 99%
- ✅ 专业建议（门洞规避、卫生间不通铺等）
- ✅ 包含踢脚线、辅料计算
- ✅ 一键生成确认单

---

## 七、总结

**核心价值**:
1. **提升销售效率** - 从 56 分钟 → 8 分钟
2. **增强客户信任** - 可视化方案对比
3. **展现专业度** - 智能优化建议
4. **降低错误率** - 自动计算，准确率 99%

**实施建议**:
- ✅ 本周完成 P0 功能（踢脚线、智能排版）
- ⚠️ 下周完成 P1 功能（门洞处理、柱子编辑）
- ⚠️ 本月完成 P2 功能（卫生间识别、多种铺贴方式）

**预期收益**:
- 销售效率提升 **85%**
- 客户满意度提升 **50%**
- 成交率提升 **30%**

---

**方案制定人**: AI 产品经理  
**制定日期**: 2026-05-06
