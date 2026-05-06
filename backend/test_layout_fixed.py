#!/usr/bin/env python3
"""
快速测试排版引擎
"""

from app.services.layout_engine import calculate_tile_layout
import json

def test_simple_rectangle():
    print("=== 测试简单矩形房间 ===")
    
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
    
    print(f"总瓷砖数: {result['statistics']['total_tiles']}")
    print(f"整砖: {result['statistics']['whole_tiles']}, 切割砖: {result['statistics']['cut_tiles']}")
    print(f"损耗率: {result['statistics']['waste_percentage']}%")
    print(f"房间面积: {result['statistics']['total_area_sq_m']} m²")
    
    if result['tiles']:
        print(f"\n前 5 块瓷砖:")
        for i, tile in enumerate(result['tiles'][:5]):
            print(f"  瓷砖 {i+1}: {tile}")
    
    print(f"\n测试完成！")
    return True

def test_with_start_point():
    print("\n=== 测试起铺点功能 ===")
    
    room = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]
    
    # 从房间中心开始铺
    start_point = (1500, 2000)
    
    result = calculate_tile_layout(
        room_polygon=room,
        tile_width=800,
        tile_height=800,
        gap_width=3,
        start_point=start_point
    )
    
    print(f"起铺点: {start_point}")
    print(f"总瓷砖数: {result['statistics']['total_tiles']}")
    print(f"整砖: {result['statistics']['whole_tiles']}, 切割砖: {result['statistics']['cut_tiles']}")
    
    return True

if __name__ == "__main__":
    try:
        test_simple_rectangle()
        test_with_start_point()
        print("\n✅ 所有测试通过！")
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
