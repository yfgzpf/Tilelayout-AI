"""
测试排版计算引擎
"""
from app.services.layout_engine import calculate_tile_layout


def test_basic_layout():
    """测试基础排版"""
    print("=" * 50)
    print("测试 1: 基础排版（3m x 4m 房间，800x800 瓷砖）")
    print("=" * 50)
    
    room = [
        [0, 0],
        [3000, 0],
        [3000, 4000],
        [0, 4000]
    ]
    
    result = calculate_tile_layout(
        room_polygon=room,
        tile_width=800,
        tile_height=800,
        gap_width=3,
        direction='horizontal'
    )
    
    print(f"瓷砖总数: {result['statistics']['total_tiles']}")
    print(f"整砖数: {result['statistics']['whole_tiles']}")
    print(f"切割砖: {result['statistics']['cut_tiles']}")
    print(f"损耗率: {result['statistics']['waste_percentage']}%")
    print(f"总面积: {result['statistics']['total_area']} m²")
    print()


def test_vertical_layout():
    """测试纵向铺贴"""
    print("=" * 50)
    print("测试 2: 纵向铺贴（3m x 4m 房间，800x800 瓷砖）")
    print("=" * 50)
    
    room = [
        [0, 0],
        [3000, 0],
        [3000, 4000],
        [0, 4000]
    ]
    
    result = calculate_tile_layout(
        room_polygon=room,
        tile_width=800,
        tile_height=800,
        gap_width=3,
        direction='vertical'
    )
    
    print(f"瓷砖总数: {result['statistics']['total_tiles']}")
    print(f"整砖数: {result['statistics']['whole_tiles']}")
    print(f"切割砖: {result['statistics']['cut_tiles']}")
    print(f"损耗率: {result['statistics']['waste_percentage']}%")
    print()


def test_small_tiles():
    """测试小瓷砖"""
    print("=" * 50)
    print("测试 3: 小瓷砖（3m x 4m 房间，600x600 瓷砖）")
    print("=" * 50)
    
    room = [
        [0, 0],
        [3000, 0],
        [3000, 4000],
        [0, 4000]
    ]
    
    result = calculate_tile_layout(
        room_polygon=room,
        tile_width=600,
        tile_height=600,
        gap_width=2,
        direction='horizontal'
    )
    
    print(f"瓷砖总数: {result['statistics']['total_tiles']}")
    print(f"整砖数: {result['statistics']['whole_tiles']}")
    print(f"切割砖: {result['statistics']['cut_tiles']}")
    print(f"损耗率: {result['statistics']['waste_percentage']}%")
    print()


def test_optimization():
    """测试优化排版"""
    print("=" * 50)
    print("测试 4: 优化排版（自动寻找最优起铺点）")
    print("=" * 50)
    
    room = [
        [0, 0],
        [3000, 0],
        [3000, 4000],
        [0, 4000]
    ]
    
    result = calculate_tile_layout(
        room_polygon=room,
        tile_width=800,
        tile_height=800,
        gap_width=3,
        direction='horizontal',
        optimize=True
    )
    
    print(f"瓷砖总数: {result['statistics']['total_tiles']}")
    print(f"整砖数: {result['statistics']['whole_tiles']}")
    print(f"切割砖: {result['statistics']['cut_tiles']}")
    print(f"损耗率: {result['statistics']['waste_percentage']}%")
    print()


if __name__ == "__main__":
    test_basic_layout()
    test_vertical_layout()
    test_small_tiles()
    test_optimization()
    
    print("✅ 所有测试完成！")
