"""排版引擎测试"""
from app.services.layout_engine import calculate_tile_layout, polygon_area, clip_rect_by_polygon, Point, Rect

ROOM = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]

r1 = calculate_tile_layout(ROOM, 800, 800, 3, 'horizontal')
s = r1['statistics']
print(f'[TEST1 800x800 横向] 总数={s["total_tiles"]} 整砖={s["whole_tiles"]} 切割={s["cut_tiles"]} 损耗={s["waste_percentage"]}% 面积={s["total_area_sq_m"]}m2')
assert s['total_tiles'] > 0, 'FAIL: 没有砖'
assert s['total_tiles'] == s['whole_tiles'] + s['cut_tiles'], 'FAIL: 统计不一致'

r2 = calculate_tile_layout(ROOM, 600, 600, 2, 'horizontal')
s = r2['statistics']
print(f'[TEST2 600x600 横向] 总数={s["total_tiles"]} 整砖={s["whole_tiles"]} 切割={s["cut_tiles"]} 损耗={s["waste_percentage"]}%')
assert s['total_tiles'] > 0

r3 = calculate_tile_layout(ROOM, 800, 800, 3, 'vertical')
s = r3['statistics']
print(f'[TEST3 800x800 纵向] 总数={s["total_tiles"]} 整砖={s["whole_tiles"]} 切割={s["cut_tiles"]} 损耗={s["waste_percentage"]}%')

r4 = calculate_tile_layout(ROOM, 800, 800, 3, 'horizontal', optimize=True)
s = r4['statistics']
print(f'[TEST4 优化排布] 总数={s["total_tiles"]} 整砖={s["whole_tiles"]} 切割={s["cut_tiles"]} 损耗={s["waste_percentage"]}%')

# 测L型房间
L_ROOM = [[0, 0], [3000, 0], [3000, 2000], [1500, 2000], [1500, 4000], [0, 4000]]
r5 = calculate_tile_layout(L_ROOM, 800, 800, 3)
s = r5['statistics']
print(f'[TEST5 L型房] 总数={s["total_tiles"]} 整砖={s["whole_tiles"]} 切割={s["cut_tiles"]} 面积={s["total_area_sq_m"]}m2')
assert s['total_tiles'] > 0

# 测三角形房间
TRI = [[0, 0], [3000, 0], [0, 3000]]
r6 = calculate_tile_layout(TRI, 800, 800, 3)
s = r6['statistics']
print(f'[TEST6 三角形] 总数={s["total_tiles"]} 整砖={s["whole_tiles"]} 切割={s["cut_tiles"]}')
assert s['total_tiles'] > 0
assert s['cut_tiles'] > 0, '三角形房间应产生切割砖'

# 测输入验证
try:
    calculate_tile_layout([[0, 0]], 800, 800)
    assert False, '应该抛异常'
except ValueError as e:
    print(f'[TEST7 输入验证] PASS: {e}')

try:
    calculate_tile_layout(ROOM, -100, 800)
    assert False
except ValueError as e:
    print(f'[TEST8 负数验证] PASS: {e}')

print()
print('=== ALL 8 TESTS PASSED ===')
