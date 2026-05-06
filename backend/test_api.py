#!/usr/bin/env python3
"""测试 API 端点"""
import asyncio
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_demo_calculate():
    """测试演示计算端点"""
    print("Testing demo calculate endpoint...")
    
    payload = {
        "room_polygon": [[0, 0], [3000, 0], [3000, 4000], [0, 4000]],
        "config": {
            "tile_width": 800,
            "tile_height": 800,
            "gap_width": 3,
            "direction": "horizontal",
            "start_point": [0, 0]
        },
        "optimize": False
    }
    
    response = client.post("/api/v1/projects/calculate/demo", json=payload)
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data['success']}")
        if data['success']:
            stats = data['data']['statistics']
            print(f"Total tiles: {stats['total_tiles']}")
            print(f"Whole tiles: {stats['whole_tiles']}")
            print(f"Cut tiles: {stats['cut_tiles']}")
            print(f"Room area: {stats['total_area_sq_m']} m²")
            print(f"\n✅ Demo endpoint test passed!")
            return True
        else:
            print("API returned an error")
    else:
        print(f"Error: {response.text}")
    
    return False


if __name__ == "__main__":
    print("=" * 50)
    print("排砖宝 API 测试")
    print("=" * 50)
    
    try:
        success = test_demo_calculate()
        if success:
            print("\n✅ All tests passed!")
            sys.exit(0)
        else:
            print("\n❌ Some tests failed!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
