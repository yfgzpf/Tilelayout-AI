#!/usr/bin/env python3
"""
测试核心排版算法（缝对齐门中功能）
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.layout_engine import (
    LayoutEngine,
    DoorPosition,
    Point,
    Rect,
)


def test_basic_layout():
    print("=" * 60)
    print("测试1: 基础排版计算")
    print("=" * 60)
    
    room = [
        [0, 0],
        [3000, 0],
        [3000, 4000],
        [0, 4000],
    ]
    
    engine = LayoutEngine(
        room_polygon=room,
        tile_width=600,
        tile_height=600,
        gap_width=2,
    )
    
    result = engine.calculate_layout()
    tiles = result["tiles"]
    stats = result["statistics"]
    
    print(f"✓ 总砖数: {stats['total_tiles']}")
    print(f"✓ 整砖: {stats['whole_tiles']}, 切割砖: {stats['cut_tiles']}")
    print(f"✓ 损耗率: {stats['waste_percentage']:.1f}%")
    print()
    return True


def test_gap_door_alignment():
    print("=" * 60)
    print("测试2: 缝对齐门中（垂直门）")
    print("=" * 60)
    
    room = [
        [0, 0],
        [3000, 0],
        [3000, 4000],
        [0, 4000],
    ]
    
    # 门在右侧边（edge index 2），中心位置
    door = DoorPosition(edge_index=2, position_ratio=0.5)
    
    engine = LayoutEngine(
        room_polygon=room,
        tile_width=600,
        tile_height=600,
        gap_width=2,
        door_position=door,
        align_gap_to_door_center=True,
    )
    
    door_center = engine._get_door_center()
    print(f"✓ 门中心坐标: ({door_center.x:.0f}, {door_center.y:.0f})")
    
    # 检查是否有缝在门中心附近
    tile_w_gap = 600 + 2
    start_x = engine.start_point[0]
    num_tiles = int((door_center.x - start_x) / tile_w_gap)
    gap_pos = start_x + num_tiles * tile_w_gap
    dist = abs(gap_pos - door_center.x)
    
    print(f"✓ 缝位置: {gap_pos:.1f} (与门中心距离: {dist:.1f}mm)")
    if dist < 1:
        print("✅ 缝精确对齐门中心！")
    else:
        print("⚠️  对齐有细微偏差")
    
    print()
    return True


def test_gap_door_alignment_horizontal():
    print("=" * 60)
    print("测试3: 缝对齐门中（水平门）")
    print("=" * 60)
    
    room = [
        [0, 0],
        [3000, 0],
        [3000, 4000],
        [0, 4000],
    ]
    
    # 门在底边（edge index 1）
    door = DoorPosition(edge_index=1, position_ratio=0.5)
    
    engine = LayoutEngine(
        room_polygon=room,
        tile_width=600,
        tile_height=600,
        gap_width=2,
        door_position=door,
        align_gap_to_door_center=True,
    )
    
    door_center = engine._get_door_center()
    print(f"✓ 门中心坐标: ({door_center.x:.0f}, {door_center.y:.0f})")
    
    tile_h_gap = 600 + 2
    start_y = engine.start_point[1]
    num_tiles = int((door_center.y - start_y) / tile_h_gap)
    gap_pos = start_y + num_tiles * tile_h_gap
    dist = abs(gap_pos - door_center.y)
    
    print(f"✓ 缝位置: {gap_pos:.1f} (与门中心距离: {dist:.1f}mm)")
    if dist < 1:
        print("✅ 缝精确对齐门中心！")
    else:
        print("⚠️  对齐有细微偏差")
    
    print()
    return True


if __name__ == "__main__":
    print()
    print("排砖宝 · 核心算法验证测试")
    print()
    
    all_passed = True
    
    tests = [
        test_basic_layout,
        test_gap_door_alignment,
        test_gap_door_alignment_horizontal,
    ]
    
    for i, test in enumerate(tests, 1):
        try:
            success = test()
            if not success:
                all_passed = False
        except Exception as e:
            print(f"❌ 测试 {i} 失败: {e}")
            import traceback
            traceback.print_exc()
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("🎉 所有核心算法测试通过！")
    else:
        print("⚠️  部分测试失败")
    print("=" * 60)
