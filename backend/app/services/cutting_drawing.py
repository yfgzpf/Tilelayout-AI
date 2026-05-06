"""
加工施工图生成引擎

根据排版结果自动生成：
1. 瓷砖编号图 (每块砖标注编号)
2. 切割加工单 (含切割砖尺寸/数量)
3. 材料统计表

输出为可直接交付工厂和施工队的加工图纸
"""
import io
import math
from typing import Dict, Any, List, Tuple, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.graphics.shapes import Drawing, Rect, Line, String, Group
from reportlab.graphics import renderPDF


BRAND_HEX = "#1a365d"
ACCENT_HEX = "#d4a574"
GRAY_HEX = "#94a3b8"


class CuttingDrawingGenerator:
    """切割加工图生成器"""

    @staticmethod
    def number_tiles(tiles: List[Dict], room_polygon: List[List[float]]) -> List[Dict]:
        numbered = []
        whole_idx = 1
        cut_idx = 1
        for t in tiles:
            entry = dict(t)
            if t.get("is_cut"):
                entry["label"] = f"C{cut_idx}"
                entry["cut_width"] = round(t.get("width", 0), 1)
                entry["cut_height"] = round(t.get("height", 0), 1)
                cut_idx += 1
            else:
                entry["label"] = f"W{whole_idx}"
                whole_idx += 1
            numbered.append(entry)
        return numbered

    @staticmethod
    def build_cut_list(tiles: List[Dict]) -> List[Dict]:
        cuts = [t for t in tiles if t.get("is_cut")]
        groups: Dict[str, Dict] = {}
        for c in cuts:
            key = f"{round(c.get('width',0),0)}x{round(c.get('height',0),0)}"
            if key not in groups:
                groups[key] = {
                    "width": round(c.get("width", 0), 0),
                    "height": round(c.get("height", 0), 0),
                    "count": 0,
                    "labels": [],
                }
            groups[key]["count"] += 1
            groups[key]["labels"].append(c.get("label", ""))
        return sorted(groups.values(), key=lambda g: g["width"] * g["height"], reverse=True)

    @staticmethod
    def to_svg(tiles: List[Dict], room_polygon: List[List[float]], w: int = 800, h: int = 600) -> str:
        if not tiles:
            return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><text x="400" y="300" text-anchor="middle" fill="#999">暂无排版数据</text></svg>'

        all_x = [t["x"] for t in tiles] + [t["x"] + t["width"] for t in tiles]
        all_y = [t["y"] for t in tiles] + [t["y"] + t["height"] for t in tiles]
        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)

        pad = 40
        scale = min((w - pad * 2) / max(max_x - min_x, 1), (h - pad * 2) / max(max_y - min_y, 1))

        parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" style="background:#fff">']
        parts.append(f'<rect width="{w}" height="{h}" fill="#f8fafc"/>')

        for t in tiles:
            rx = pad + (t["x"] - min_x) * scale
            ry = pad + (t["y"] - min_y) * scale
            rw = max(t["width"] * scale, 1)
            rh = max(t["height"] * scale, 1)
            fill = "#d4a574" if t.get("is_cut") else "#1a365d"
            parts.append(
                f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
                f'fill="{fill}" fill-opacity="0.15" stroke="{fill}" stroke-width="1.5"/>'
            )
            cx = rx + rw / 2
            cy = ry + rh / 2
            if rw > 20 and rh > 14:
                parts.append(
                    f'<text x="{cx:.1f}" y="{cy:.1f}" text-anchor="middle" dominant-baseline="central" '
                    f'font-size="9" font-weight="bold" fill="{fill}">{t.get("label", "")}</text>'
                )

        parts.append("</svg>")
        return "\n".join(parts)


def generate_cutting_drawing_pdf(
    project_name: str,
    tiles: List[Dict],
    room_polygon: List[List[float]],
    statistics: Optional[Dict] = None,
) -> io.BytesIO:
    gen = CuttingDrawingGenerator()
    numbered = gen.number_tiles(tiles, room_polygon)
    cut_list = gen.build_cut_list(numbered)
    svg = gen.to_svg(numbered, room_polygon)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)

    from reportlab.pdfbase import pdfmetrics
    font_name = "Helvetica"

    title_style = ParagraphStyle("TT", fontName=font_name, fontSize=18, leading=24, textColor=HexColor(BRAND_HEX), spaceAfter=12)
    heading_style = ParagraphStyle("TH", fontName=font_name, fontSize=14, leading=18, textColor=HexColor(BRAND_HEX), spaceBefore=12, spaceAfter=8)
    body_style = ParagraphStyle("TB", fontName=font_name, fontSize=9, leading=14)

    story = []

    story.append(Paragraph(f"瓷砖切割加工单 - {project_name}", title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(ACCENT_HEX)))
    story.append(Spacer(1, 6*mm))

    if statistics:
        stats_text = (
            f"总砖数: {statistics.get('total_tiles', 0)}片 | "
            f"整砖: {statistics.get('whole_tiles', 0)}片 | "
            f"切割砖: {statistics.get('cut_tiles', 0)}片 | "
            f"损耗率: {statistics.get('waste_percentage', 0)}%"
        )
        story.append(Paragraph(stats_text, body_style))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("切割砖清单 (按尺寸分组)", heading_style))

    if cut_list:
        table_data = [["编号", "宽度(mm)", "高度(mm)", "数量", "砖号"]]
        for i, c in enumerate(cut_list):
            table_data.append([
                str(i + 1),
                str(int(c["width"])),
                str(int(c["height"])),
                str(c["count"]),
                ", ".join(c["labels"][:5]) + ("..." if len(c["labels"]) > 5 else ""),
            ])

        t = Table(table_data, colWidths=[30*mm, 30*mm, 30*mm, 20*mm, 80*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor(BRAND_HEX)),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor(GRAY_HEX)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#f1f5f9")]),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("本方案无需切割加工", body_style))

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("注意事项:", heading_style))
    story.append(Paragraph("1. 切割砖尺寸已标注为理论值，实际加工请预留2-3mm锯缝", body_style))
    story.append(Paragraph("2. 建议按编号顺序加工，先切大尺寸后切小尺寸", body_style))
    story.append(Paragraph("3. 釉面砖切割方向应从釉面向下，避免崩边", body_style))
    story.append(Paragraph("4. 加工后核对尺寸与编号，避免错贴", body_style))

    story.append(PageBreak())
    story.append(Paragraph(f"瓷砖编号施工图 - {project_name}", title_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(ACCENT_HEX)))
    story.append(Spacer(1, 6*mm))

    svg_bytes = svg.encode("utf-8")
    try:
        from reportlab.graphics import renderPM
        from svglib.svglib import svg2rlg
        drawing = svg2rlg(io.BytesIO(svg_bytes))
        if drawing:
            story.append(drawing)
    except ImportError:
        story.append(Paragraph("(施工图预览 — 安装svglib后可渲染矢量图)", body_style))

    story.append(Spacer(1, 10*mm))
    story.append(Paragraph("图例: 蓝色框=整砖 | 金色框=切割砖 | C=切割编号 | W=整砖编号", body_style))

    doc.build(buf)
    buf.seek(0)
    return buf
