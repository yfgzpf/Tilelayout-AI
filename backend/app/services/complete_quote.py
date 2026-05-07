"""
完整报价单生成服务

整合：
- 主砖用量与价格
- 踢脚线（从主砖切割）
- 门头石（所有门洞）
- 辅料（瓷砖胶、美缝剂、水泥砂、十字卡）
- 防水涂料（厨卫阳台）
- 界面剂（可选）
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from decimal import Decimal
import math


@dataclass
class QuoteItem:
    name: str
    spec: str
    qty: float
    unit: str
    unit_price: float
    amount: float
    remark: str = ""


@dataclass
class CompleteQuote:
    project_name: str
    area_sq_m: float
    items: List[QuoteItem] = field(default_factory=list)
    total_amount: float = 0.0
    main_tile_cost: float = 0.0
    auxiliary_cost: float = 0.0
    threshold_cost: float = 0.0
    skirting_cost: float = 0.0
    waterproof_cost: float = 0.0

    def to_dict(self) -> Dict:
        return {
            "project_name": self.project_name,
            "area_sq_m": self.area_sq_m,
            "items": [
                {
                    "name": item.name,
                    "spec": item.spec,
                    "qty": item.qty,
                    "unit": item.unit,
                    "unit_price": item.unit_price,
                    "amount": item.amount,
                    "remark": item.remark,
                }
                for item in self.items
            ],
            "total_amount": self.total_amount,
            "main_tile_cost": self.main_tile_cost,
            "auxiliary_cost": self.auxiliary_cost,
            "threshold_cost": self.threshold_cost,
            "skirting_cost": self.skirting_cost,
            "waterproof_cost": self.waterproof_cost,
        }


class CompleteQuoteGenerator:
    """完整报价单生成器"""

    @staticmethod
    def calc_waterproof(
        area_sq_m: float,
        coats: int = 2,
        usage_per_sq_m_kg: float = 1.5,
        bucket_weight_kg: float = 18.0,
        unit_price: float = 280.0,
    ) -> Dict:
        total_kg = area_sq_m * coats * usage_per_sq_m_kg
        total_buckets = math.ceil(total_kg / bucket_weight_kg)
        amount = total_buckets * unit_price

        return {
            "name": "防水涂料",
            "spec": f"{bucket_weight_kg}kg/桶",
            "qty": total_buckets,
            "unit": "桶",
            "unit_price": unit_price,
            "amount": round(amount, 2),
            "remark": f"{coats}遍涂刷，{area_sq_m}m²",
        }

    @staticmethod
    def calc_interface_agent(
        area_sq_m: float,
        usage_per_sq_m_kg: float = 0.2,
        bucket_weight_kg: float = 20.0,
        unit_price: float = 120.0,
    ) -> Dict:
        total_kg = area_sq_m * usage_per_sq_m_kg
        total_buckets = math.ceil(total_kg / bucket_weight_kg)
        amount = total_buckets * unit_price

        return {
            "name": "界面剂",
            "spec": f"{bucket_weight_kg}kg/桶",
            "qty": total_buckets,
            "unit": "桶",
            "unit_price": unit_price,
            "amount": round(amount, 2),
            "remark": f"{area_sq_m}m²基层处理",
        }

    @staticmethod
    def generate_complete_quote(
        project_name: str,
        area_sq_m: float,
        tile_width_mm: int,
        tile_height_mm: int,
        gap_width_mm: float = 3.0,
        tile_price: float = 50.0,
        room_perimeter_mm: float = 0.0,
        door_gaps: Optional[List[Dict]] = None,
        include_waterproof: bool = False,
        waterproof_area_sq_m: float = 0.0,
        include_interface_agent: bool = False,
        auxiliary_prices: Optional[Dict[str, float]] = None,
        threshold_material: str = "marble",
    ) -> CompleteQuote:
        quote = CompleteQuote(
            project_name=project_name,
            area_sq_m=area_sq_m,
        )

        prices = auxiliary_prices or {}
        items = []

        tile_w_m = tile_width_mm / 1000.0
        tile_h_m = tile_height_mm / 1000.0
        tile_area = tile_w_m * tile_h_m
        tiles_needed = math.ceil(area_sq_m / tile_area * 1.05)
        main_tile_amount = tiles_needed * tile_price

        items.append(QuoteItem(
            name="主砖",
            spec=f"{tile_width_mm}×{tile_height_mm}mm",
            qty=tiles_needed,
            unit="片",
            unit_price=tile_price,
            amount=round(main_tile_amount, 2),
            remark=f"含5%损耗",
        ))
        quote.main_tile_cost = round(main_tile_amount, 2)

        from app.services.auxiliary_material import AuxiliaryCalculator
        aux_result = AuxiliaryCalculator.calculate_all(
            area_sq_m=area_sq_m,
            tile_width_mm=tile_width_mm,
            tile_height_mm=tile_height_mm,
            gap_width_mm=gap_width_mm,
            total_tiles=tiles_needed,
            unit_prices=prices,
        )

        for cost_item in aux_result.cost_items:
            items.append(QuoteItem(
                name=cost_item["name"],
                spec=cost_item.get("unit", ""),
                qty=cost_item["qty"],
                unit=cost_item["unit"],
                unit_price=cost_item.get("unit_price", 0),
                amount=cost_item["amount"],
                remark="",
            ))
        quote.auxiliary_cost = aux_result.total_cost

        if room_perimeter_mm > 0:
            from app.services.skirting_calculator import SkirtingCalculator
            skirting_result = SkirtingCalculator.calculate_from_main_tile(
                room_perimeter=room_perimeter_mm / 1000.0,
                door_width=sum(d.get("width", 800) for d in (door_gaps or [])) / 1000.0,
                tile_width=tile_width_mm,
                tile_height=tile_height_mm,
                skirting_height=80,
                tile_price=tile_price,
            )
            items.append(QuoteItem(
                name="踢脚线",
                spec="80mm高（从主砖切割）",
                qty=skirting_result.tiles_needed,
                unit="片",
                unit_price=tile_price,
                amount=round(skirting_result.cost, 2),
                remark=f"周长{room_perimeter_mm}mm，需{skirting_result.tiles_needed}片",
            ))
            quote.skirting_cost = round(skirting_result.cost, 2)

        if door_gaps:
            from app.services.door_optimizer import DoorOptimizer, DoorGap
            door_objects = [
                DoorGap(
                    id=f"door_{i}",
                    x=0,
                    y=0,
                    width=d.get("width", 800),
                    type=d.get("position", "entrance"),
                )
                for i, d in enumerate(door_gaps)
            ]
            thresholds = DoorOptimizer.calculate_all_thresholds(
                doors=door_objects,
                material=threshold_material,
            )
            for threshold in thresholds:
                items.append(QuoteItem(
                    name="门头石",
                    spec=f"{threshold.material} {threshold.length}mm",
                    qty=1,
                    unit="条",
                    unit_price=threshold.cost,
                    amount=round(threshold.cost, 2),
                    remark=f"门头石",
                ))
                quote.threshold_cost += threshold.cost

        if include_waterproof and waterproof_area_sq_m > 0:
            waterproof_item = CompleteQuoteGenerator.calc_waterproof(
                area_sq_m=waterproof_area_sq_m,
                unit_price=prices.get("waterproof_bucket", 280.0),
            )
            items.append(QuoteItem(
                name=waterproof_item["name"],
                spec=waterproof_item["spec"],
                qty=waterproof_item["qty"],
                unit=waterproof_item["unit"],
                unit_price=waterproof_item["unit_price"],
                amount=waterproof_item["amount"],
                remark=waterproof_item["remark"],
            ))
            quote.waterproof_cost = waterproof_item["amount"]

        if include_interface_agent:
            interface_item = CompleteQuoteGenerator.calc_interface_agent(
                area_sq_m=area_sq_m,
                unit_price=prices.get("interface_agent_bucket", 120.0),
            )
            items.append(QuoteItem(
                name=interface_item["name"],
                spec=interface_item["spec"],
                qty=interface_item["qty"],
                unit=interface_item["unit"],
                unit_price=interface_item["unit_price"],
                amount=interface_item["amount"],
                remark=interface_item["remark"],
            ))

        quote.items = items
        quote.total_amount = round(sum(item.amount for item in items), 2)

        return quote
