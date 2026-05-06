#!/usr/bin/env python3
"""简单的核心逻辑测试"""
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.layout_engine import calculate_tile_layout


def test_layout():
    print("=" * 50)
    print("测试核心排版逻辑")
    print("=" * 50)
    
    # 3000x4000mm 房间
    room = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]
    
    # 800x800mm 瓷砖，3mm 留缝
    result = calculate_tile_layout(
        room_polygon=room,
        tile_width=800,
        tile_height=800,
        gap_width=3,
        direction='horizontal',
        start_point=(0, 0)
    )
    
    stats = result['statistics']
    print(f"✅ 排版计算成功！")
    print(f"总砖数: {stats['total_tiles']}")
    print(f"整砖: {stats['whole_tiles']}")
    print(f"切割砖: {stats['cut_tiles']}")
    print(f"损耗率: {stats['waste_percentage']}%")
    print(f"房间面积: {stats['total_area_sq_m']} m²")
    
    # 打印前5块砖
    print(f"\n前5块砖:")
    for i, tile in enumerate(result['tiles'][:5]):
        print(f"  砖 {i+1}: x={tile['x']:.0f}, y={tile['y']:.0f}, "
              f"w={tile['width']:.0f}, h={tile['height']:.0f}, "
              f"{'切' if tile['is_cut'] else '整'}")
    
    print("\n" + "=" * 50)
    print("所有测试通过！")
    return True


if __name__ == "__main__":
    try:
        test_layout()
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
