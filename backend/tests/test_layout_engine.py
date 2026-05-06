"""排砖宝后端完整测试套件"""
import pytest
import math
import sys
sys.path.insert(0, '.')

from app.services.layout_engine import (
    calculate_tile_layout, LayoutEngine,
    polygon_area, polygon_bounds, clip_rect_by_polygon,
    point_in_polygon, Point, Rect
)


class TestGeometryFunctions:
    def test_polygon_area_square(self):
        pts = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        assert polygon_area(pts) == pytest.approx(100.0)

    def test_polygon_area_triangle(self):
        pts = [Point(0, 0), Point(10, 0), Point(0, 10)]
        assert polygon_area(pts) == pytest.approx(50.0)

    def test_polygon_area_empty(self):
        assert polygon_area([]) == 0.0
        assert polygon_area([Point(0, 0)]) == 0.0

    def test_polygon_bounds(self):
        pts = [Point(1, 2), Point(10, 2), Point(10, 8), Point(1, 8)]
        min_x, min_y, max_x, max_y = polygon_bounds(pts)
        assert min_x == 1.0
        assert min_y == 2.0
        assert max_x == 10.0
        assert max_y == 8.0

    def test_point_in_polygon(self):
        poly = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        assert point_in_polygon(Point(5, 5), poly) is True
        assert point_in_polygon(Point(-1, 5), poly) is False
        assert point_in_polygon(Point(5, -1), poly) is False

    def test_clip_rect_by_polygon_full_inside(self):
        rect = Rect(2, 2, 5, 5)
        poly = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        clipped = clip_rect_by_polygon(rect, poly)
        assert len(clipped) >= 3
        assert polygon_area(clipped) == pytest.approx(25.0)

    def test_clip_rect_by_polygon_partial(self):
        rect = Rect(-5, -5, 10, 10)
        poly = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        clipped = clip_rect_by_polygon(rect, poly)
        area = polygon_area(clipped)
        assert area == pytest.approx(25.0)


class TestLayoutEngine:
    ROOM = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]

    def test_basic_layout_800x800(self):
        r = calculate_tile_layout(self.ROOM, 800, 800, 3, 'horizontal')
        s = r['statistics']
        assert s['total_tiles'] > 0
        assert s['total_tiles'] == s['whole_tiles'] + s['cut_tiles']
        assert s['total_area_sq_m'] == pytest.approx(12.0)

    def test_basic_layout_600x600(self):
        r = calculate_tile_layout(self.ROOM, 600, 600, 2, 'horizontal')
        s = r['statistics']
        assert s['total_tiles'] > s['whole_tiles'] or s['total_tiles'] > 10

    def test_vertical_layout(self):
        r = calculate_tile_layout(self.ROOM, 800, 800, 3, 'vertical')
        assert r['statistics']['total_tiles'] > 0

    def test_optimize_layout(self):
        r = calculate_tile_layout(self.ROOM, 800, 800, 3, 'horizontal', optimize=True)
        assert r['statistics']['total_tiles'] > 0
        assert r is not None

    def test_l_shaped_room(self):
        room = [[0, 0], [3000, 0], [3000, 2000], [1500, 2000], [1500, 4000], [0, 4000]]
        r = calculate_tile_layout(room, 800, 800, 3)
        assert r['statistics']['total_tiles'] > 0
        assert r['statistics']['cut_tiles'] >= 0

    def test_triangle_room(self):
        room = [[0, 0], [3000, 0], [0, 3000]]
        r = calculate_tile_layout(room, 800, 800, 3)
        assert r['statistics']['total_tiles'] > 0
        assert r['statistics']['cut_tiles'] > 0

    def test_tiles_structure(self):
        r = calculate_tile_layout(self.ROOM, 800, 800, 3)
        for tile in r['tiles']:
            assert 'id' in tile
            assert 'x' in tile
            assert 'y' in tile
            assert 'width' in tile
            assert 'height' in tile
            assert 'is_cut' in tile
            assert isinstance(tile['is_cut'], bool)

    def test_waste_percentage(self):
        r = calculate_tile_layout(self.ROOM, 800, 800, 3)
        waste = r['statistics']['waste_percentage']
        assert waste >= 0, f"waste should be >= 0, got {waste}"


class TestInputValidation:
    ROOM = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]

    def test_few_vertices(self):
        with pytest.raises(ValueError, match='至少需要3个顶点'):
            calculate_tile_layout([[0, 0]], 800, 800)

    def test_negative_tile_width(self):
        with pytest.raises(ValueError, match='瓷砖尺寸必须大于0'):
            calculate_tile_layout(self.ROOM, -100, 800)

    def test_negative_tile_height(self):
        with pytest.raises(ValueError, match='瓷砖尺寸必须大于0'):
            calculate_tile_layout(self.ROOM, 800, -100)

    def test_negative_gap(self):
        with pytest.raises(ValueError, match='留缝宽度不能为负数'):
            calculate_tile_layout(self.ROOM, 800, 800, -5)

    def test_invalid_direction(self):
        with pytest.raises(ValueError, match='方向必须为'):
            calculate_tile_layout(self.ROOM, 800, 800, 3, 'invalid_dir')

    def test_zero_tile_width(self):
        with pytest.raises(ValueError):
            calculate_tile_layout(self.ROOM, 0, 800)


class TestSecurity:
    def test_engine_not_mutate_input(self):
        original = [[0, 0], [3000, 0], [3000, 4000], [0, 4000]]
        input_copy = [list(p) for p in original]
        calculate_tile_layout(original, 800, 800)
        assert original == input_copy
