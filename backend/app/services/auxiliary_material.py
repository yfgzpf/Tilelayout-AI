"""
辅料计算引擎

根据验收标准 1.3 节实现，涵盖：
- 1.3.1 瓷砖胶/粘结剂计算
- 1.3.2 美缝剂计算
- 1.3.3 沙子/水泥计算（传统水泥砂浆铺贴）
- 1.3.4 十字卡/找平器计算
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import math


@dataclass
class AdhesiveResult:
    name: str = "瓷砖胶(粘结剂)"
    spec: str = "kg"
    area_sq_m: float = 0.0
    usage_per_sq_m: float = 0.0
    total_kg: float = 0.0
    total_bags: int = 0
    bag_weight_kg: float = 25.0
    formula_desc: str = ""
    unit_price: Optional[float] = None


@dataclass
class GroutResult:
    name: str = "美缝剂(双组份)"
    spec: str = "支"
    total_seam_length_m: float = 0.0
    seam_depth_mm: float = 3.0
    seam_width_mm: float = 2.0
    coverage_per_unit_m: float = 15.0
    total_units: int = 0
    waste_factor: float = 1.1
    formula_desc: str = ""
    unit_price: Optional[float] = None


@dataclass
class CementSandResult:
    name: str = "水泥砂浆"
    spec: str = ""
    area_sq_m: float = 0.0
    thickness_mm: float = 30.0
    cement_kg: float = 0.0
    sand_cubic_m: float = 0.0
    sand_kg: float = 0.0
    cement_bags: int = 0
    mix_ratio: str = "1:3"
    formula_desc: str = ""
    unit_price: Optional[float] = None


@dataclass
class SpacerResult:
    name: str = "十字卡/找平器"
    spec: str = "包"
    tile_count: int = 0
    spacers_per_tile: float = 5.0
    pieces_per_bag: int = 200
    total_bags: int = 0
    formula_desc: str = ""
    unit_price: Optional[float] = None


@dataclass
class WaterproofResult:
    name: str = "防水涂料"
    spec: str = "桶"
    area_sq_m: float = 0.0
    coats: int = 2
    usage_per_sq_m_kg: float = 1.5
    total_kg: float = 0.0
    total_buckets: int = 0
    bucket_weight_kg: float = 18.0
    formula_desc: str = ""
    unit_price: Optional[float] = None


@dataclass
class AuxiliaryMaterials:
    adhesive: Optional[AdhesiveResult] = None
    grout: Optional[GroutResult] = None
    cement_sand: Optional[CementSandResult] = None
    spacers: Optional[SpacerResult] = None
    total_cost: float = 0.0
    cost_items: List[Dict] = field(default_factory=list)

    def to_dict(self) -> Dict:
        result = {"items": [], "total_cost": self.total_cost}
        for attr_name in ("adhesive", "grout", "cement_sand", "spacers"):
            item = getattr(self, attr_name)
            if item is None:
                continue
            d = {}
            for k, v in item.__dict__.items():
                if v is not None:
                    d[k] = v
            result["items"].append(d)
        return result


class AuxiliaryCalculator:
    """辅料计算器"""

    ADHESIVE_COEFFICIENTS = {
        "small": {"max_tile_size": 300, "base": 3.0, "description": "小砖(≤300mm), 薄贴法"},
        "medium": {"max_tile_size": 600, "base": 4.5, "description": "中砖(300-600mm), 组合法"},
        "large": {"max_tile_size": 1200, "base": 6.0, "description": "大砖(600-1200mm), 厚贴法"},
        "xlarge": {"max_tile_size": float("inf"), "base": 8.0, "description": "超大砖(>1200mm), 重型齿刀"},
    }

    SUBSTRATE_COEFFICIENTS = {
        "smooth": 1.0,
        "normal": 1.15,
        "rough": 1.35,
        "uneven": 1.6,
    }

    GROUT_COVERAGE_REFERENCE = {
        "300x300": 18,
        "300x600": 14,
        "400x800": 12,
        "600x600": 12,
        "800x800": 10,
        "600x1200": 9,
        "900x900": 9,
        "750x1500": 7,
    }

    DEFAULT_GROUT_COVERAGE = 12.0

    @staticmethod
    def calc_adhesive(
        area_sq_m: float,
        tile_width_mm: float,
        tile_height_mm: float,
        substrate_type: str = "normal",
    ) -> AdhesiveResult:
        max_side = max(tile_width_mm, tile_height_mm)
        coeff_data = next(
            (c for c in AuxiliaryCalculator.ADHESIVE_COEFFICIENTS.values()
             if max_side <= c["max_tile_size"]),
            AuxiliaryCalculator.ADHESIVE_COEFFICIENTS["xlarge"],
        )
        base_usage = coeff_data["base"]
        substrate_factor = AuxiliaryCalculator.SUBSTRATE_COEFFICIENTS.get(
            substrate_type, 1.15
        )
        usage_per_sq_m = round(base_usage * substrate_factor, 2)
        total_kg = round(area_sq_m * usage_per_sq_m, 2)
        bag_weight = 25.0
        total_bags = math.ceil(total_kg / bag_weight if total_kg > 0 else 1)

        desc_parts = [
            f"瓷砖规格: {int(tile_width_mm)}×{int(tile_height_mm)}mm",
            f"铺贴系数: {coeff_data['description']}({usage_per_sq_m}kg/m²)",
            f"基层类型: {substrate_type}(系数{substrate_factor})",
            f"计算公式: {area_sq_m}m² × {usage_per_sq_m}kg/m² = {total_kg}kg",
            f"每包{bag_weight}kg, 共需 {total_bags} 包",
        ]

        return AdhesiveResult(
            area_sq_m=area_sq_m,
            usage_per_sq_m=usage_per_sq_m,
            total_kg=total_kg,
            total_bags=total_bags,
            bag_weight_kg=bag_weight,
            formula_desc="; ".join(desc_parts),
        )

    @staticmethod
    def calc_grout(
        area_sq_m: float,
        tile_width_mm: float,
        tile_height_mm: float,
        gap_width_mm: float = 2.0,
        total_tiles: int = 0,
        waste_factor: float = 1.1,
    ) -> GroutResult:
        tile_w_m = tile_width_mm / 1000.0
        tile_h_m = tile_height_mm / 1000.0

        if total_tiles <= 0:
            total_tiles = max(1, int(area_sq_m / (tile_w_m * tile_h_m)))

        tiles_per_row = max(1, int(math.sqrt(total_tiles * tile_w_m / tile_h_m)))
        tiles_per_col = max(1, int(math.ceil(total_tiles / tiles_per_row)))

        total_seam_len_x = (tiles_per_row - 1) * tile_h_m * tiles_per_col
        total_seam_len_y = (tiles_per_col - 1) * tile_w_m * tiles_per_row
        total_seam_len = total_seam_len_x + total_seam_len_y

        depth_mm = min(gap_width_mm * 1.5, 4.0)
        seam_key = f"{int(tile_width_mm)}x{int(tile_height_mm)}"
        coverage = AuxiliaryCalculator.GROUT_COVERAGE_REFERENCE.get(
            seam_key, AuxiliaryCalculator.DEFAULT_GROUT_COVERAGE
        )
        adj_coverage = coverage * (2.0 / gap_width_mm) if gap_width_mm > 0 else coverage

        total_units = max(1, math.ceil(total_seam_len / adj_coverage * waste_factor))

        desc_parts = [
            f"砖缝总长: {round(total_seam_len, 2)}m",
            f"留缝宽度: {gap_width_mm}mm",
            f"每支覆盖: {round(adj_coverage, 1)}m",
            f"损耗系数: {waste_factor}",
            f"计算公式: {round(total_seam_len, 2)}m ÷ {round(adj_coverage, 1)}m/支 × {waste_factor} = {total_units}支",
        ]

        return GroutResult(
            total_seam_length_m=round(total_seam_len, 2),
            seam_depth_mm=round(depth_mm, 1),
            seam_width_mm=gap_width_mm,
            coverage_per_unit_m=round(adj_coverage, 1),
            total_units=total_units,
            waste_factor=waste_factor,
            formula_desc="; ".join(desc_parts),
        )

    @staticmethod
    def calc_cement_sand(
        area_sq_m: float,
        thickness_mm: float = 30.0,
        mix_ratio: str = "1:3",
    ) -> CementSandResult:
        parts = mix_ratio.split(":")
        cement_part = float(parts[0])
        sand_part = float(parts[1])
        total_parts = cement_part + sand_part

        volume = area_sq_m * (thickness_mm / 1000.0)
        cement_density = 1500.0
        sand_density = 1600.0

        cement_kg = volume * (cement_part / total_parts) * cement_density
        sand_kg = volume * (sand_part / total_parts) * sand_density
        sand_cubic_m = volume * (sand_part / total_parts)

        cement_kg = round(cement_kg, 2)
        sand_kg = round(sand_kg, 2)
        sand_cubic_m = round(sand_cubic_m, 4)
        cement_bags = max(1, math.ceil(cement_kg / 50.0))

        desc_parts = [
            f"铺贴厚度: {thickness_mm}mm",
            f"配合比: 水泥:砂子 = {mix_ratio}",
            f"总体积: {round(volume, 3)}m³",
            f"水泥: {cement_kg}kg ({cement_bags}袋×50kg)",
            f"砂子: {sand_kg}kg ({sand_cubic_m}m³)",
        ]

        return CementSandResult(
            area_sq_m=area_sq_m,
            thickness_mm=thickness_mm,
            cement_kg=cement_kg,
            sand_cubic_m=sand_cubic_m,
            sand_kg=sand_kg,
            cement_bags=cement_bags,
            mix_ratio=mix_ratio,
            formula_desc="; ".join(desc_parts),
        )

    @staticmethod
    def calc_spacers(
        total_tiles: int,
        spacers_per_tile: float = 5.0,
        pieces_per_bag: int = 200,
    ) -> SpacerResult:
        total_pieces = total_tiles * spacers_per_tile
        total_bags = max(1, math.ceil(total_pieces / pieces_per_bag))

        desc_parts = [
            f"瓷砖总数: {total_tiles}片",
            f"每片用量: {spacers_per_tile}个定位器",
            f"总计: {int(total_pieces)}个 ≈ {total_bags}包({pieces_per_bag}个/包)",
        ]

        return SpacerResult(
            tile_count=total_tiles,
            spacers_per_tile=spacers_per_tile,
            pieces_per_bag=pieces_per_bag,
            total_bags=total_bags,
            formula_desc="; ".join(desc_parts),
        )

    @staticmethod
    def calculate_all(
        area_sq_m: float,
        tile_width_mm: float,
        tile_height_mm: float,
        gap_width_mm: float = 2.0,
        total_tiles: int = 0,
        substrate_type: str = "normal",
        method: str = "adhesive",
        thickness_mm: float = 30.0,
        unit_prices: Optional[Dict[str, float]] = None,
    ) -> AuxiliaryMaterials:
        result = AuxiliaryMaterials()
        prices = unit_prices or {}
        cost_items = []

        tile_count = total_tiles if total_tiles > 0 else max(
            1, int(area_sq_m / (tile_width_mm / 1000.0 * tile_height_mm / 1000.0))
        )

        if method in ("adhesive", "both"):
            result.adhesive = AuxiliaryCalculator.calc_adhesive(
                area_sq_m=area_sq_m,
                tile_width_mm=tile_width_mm,
                tile_height_mm=tile_height_mm,
                substrate_type=substrate_type,
            )
            bag_price = prices.get("adhesive_bag", 0)
            item_cost = result.adhesive.total_bags * bag_price
            cost_items.append({
                "name": result.adhesive.name,
                "qty": result.adhesive.total_bags,
                "unit": f"包({result.adhesive.bag_weight_kg}kg)",
                "unit_price": bag_price,
                "amount": round(item_cost, 2),
            })

        if method in ("cement", "both"):
            result.cement_sand = AuxiliaryCalculator.calc_cement_sand(
                area_sq_m=area_sq_m,
                thickness_mm=thickness_mm,
            )
            cement_price = prices.get("cement_bag", 0)
            sand_price = prices.get("sand_cubic_m", 0)
            cement_cost = result.cement_sand.cement_bags * cement_price
            sand_cost = result.cement_sand.sand_cubic_m * sand_price
            cost_items.append({
                "name": "水泥(P.O42.5)",
                "qty": result.cement_sand.cement_bags,
                "unit": "袋(50kg)",
                "unit_price": cement_price,
                "amount": round(cement_cost, 2),
            })
            cost_items.append({
                "name": "砂子(中砂)",
                "qty": result.cement_sand.sand_cubic_m,
                "unit": "m³",
                "unit_price": sand_price,
                "amount": round(sand_cost, 2),
            })

        result.grout = AuxiliaryCalculator.calc_grout(
            area_sq_m=area_sq_m,
            tile_width_mm=tile_width_mm,
            tile_height_mm=tile_height_mm,
            gap_width_mm=gap_width_mm,
            total_tiles=tile_count,
        )
        unit_price = prices.get("grout_unit", 0)
        item_cost = result.grout.total_units * unit_price
        cost_items.append({
            "name": result.grout.name,
            "qty": result.grout.total_units,
            "unit": "支",
            "unit_price": unit_price,
            "amount": round(item_cost, 2),
        })

        result.spacers = AuxiliaryCalculator.calc_spacers(
            total_tiles=tile_count,
        )
        spacer_price = prices.get("spacer_bag", 0)
        item_cost = result.spacers.total_bags * spacer_price
        cost_items.append({
            "name": result.spacers.name,
            "qty": result.spacers.total_bags,
            "unit": "包",
            "unit_price": spacer_price,
            "amount": round(item_cost, 2),
        })

        result.total_cost = round(sum(c["amount"] for c in cost_items), 2)
        result.cost_items = cost_items
        return result
