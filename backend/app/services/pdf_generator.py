"""
PDF 确认单生成引擎(基于reportlab)
"""
import io
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
import os

BRAND_HEX = "#1a365d"
ACCENT_HEX = "#d4a574"
GRAY_HEX = "#94a3b8"
LIGHT_GRAY_HEX = "#f1f5f9"

FONT_REGISTERED = False

def _register_fonts():
    global FONT_REGISTERED
    if FONT_REGISTERED:
        return
    font_paths = [
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                pdfmetrics.registerFont(TTFont("CJK", fp))
                FONT_REGISTERED = True
                return
            except Exception:
                continue
    FONT_REGISTERED = True


def _get_font_name() -> str:
    _register_fonts()
    return "CJK" if FONT_REGISTERED else "Helvetica"


def create_confirmation_pdf(
    project_data: Dict[str, Any],
    is_member: bool = False,
    store_profile: Optional[Dict[str, Any]] = None,
    layout_preview_image: Optional[bytes] = None,
    materials: Optional[List[Dict[str, Any]]] = None,
    auxiliary_materials: Optional[Dict[str, Any]] = None,
    show_price: bool = True,
) -> io.BytesIO:
    _register_fonts()
    font_name = _get_font_name()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20*mm, bottomMargin=20*mm,
        leftMargin=18*mm, rightMargin=18*mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CJ_Title", fontName=font_name, fontSize=24, leading=30,
        textColor=HexColor(BRAND_HEX), alignment=TA_CENTER, spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "CJ_Heading", fontName=font_name, fontSize=16, leading=22,
        textColor=HexColor(BRAND_HEX), spaceAfter=8, spaceBefore=16,
    )
    body_style = ParagraphStyle(
        "CJ_Body", fontName=font_name, fontSize=10, leading=16,
        textColor=black, spaceAfter=4,
    )
    small_style = ParagraphStyle(
        "CJ_Small", fontName=font_name, fontSize=8, leading=12,
        textColor=HexColor(GRAY_HEX), alignment=TA_CENTER,
    )
    upgrade_style = ParagraphStyle(
        "CJ_Upgrade", fontName=font_name, fontSize=14, leading=20,
        textColor=HexColor(ACCENT_HEX), alignment=TA_CENTER,
    )

    project_name = project_data.get("project_name", "未命名方案")
    project_area = project_data.get("area_sq_m", 0)
    project_id = project_data.get("project_id", "NEW-001")
    store = store_profile or {}

    story = []

    hr = HRFlowable(width="100%", thickness=1, color=HexColor(ACCENT_HEX))

    # ===== 封面 =====
    story.append(Spacer(1, 40*mm))
    story.append(Paragraph("瓷砖铺贴方案确认单", title_style))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph(project_name, ParagraphStyle(
        "CJ_Subtitle", fontName=font_name, fontSize=18, leading=24,
        textColor=HexColor(ACCENT_HEX), alignment=TA_CENTER,
    )))
    story.append(Spacer(1, 20*mm))

    if is_member and store.get("store_name"):
        story.append(Paragraph(f"<b>{store['store_name']}</b>", body_style))
        if store.get("phone"):
            story.append(Paragraph(f"电话: {store['phone']}", body_style))
    else:
        story.append(Paragraph("⬆ 升级会员，展示您的品牌与联系方式", upgrade_style))

    story.append(Spacer(1, 10*mm))
    story.append(hr)
    story.append(Paragraph(f"户型面积: {project_area}m² | 方案编号: {project_id} | {datetime.now().strftime('%Y年%m月%d日')}", small_style))
    story.append(PageBreak())

    # ===== 效果图 =====
    story.append(Paragraph(f"铺贴效果图 - {project_name}", heading_style))
    if layout_preview_image:
        img = Image(io.BytesIO(layout_preview_image), width=160*mm, height=100*mm)
        story.append(img)
    story.append(PageBreak())

    # ===== 材料明细 =====
    story.append(Paragraph(f"材料明细清单 - {project_name}", heading_style))

    all_materials = []
    if materials:
        all_materials.extend(materials)
    if auxiliary_materials and auxiliary_materials.get("cost_items"):
        all_materials.extend(auxiliary_materials["cost_items"])

    if all_materials:
        if show_price and is_member:
            table_data = [["品名", "规格", "数量", "单价(元)", "金额(元)"]]
            for m in all_materials:
                table_data.append([
                    m.get("name", "-"),
                    m.get("unit", "-"),
                    str(m.get("qty", 0)),
                    f"¥{m.get('unit_price', 0):.2f}",
                    f"¥{m.get('amount', 0):.2f}",
                ])
            total_val = sum(m.get("amount", 0) for m in all_materials)
            table_data.append(["", "", "", "合计", f"¥{total_val:.2f}"])
        else:
            table_data = [["品名", "规格", "数量"]]
            for m in all_materials:
                table_data.append([
                    m.get("name", "-"),
                    m.get("unit", "-"),
                    str(m.get("qty", 0)),
                ])

        col_widths = [70*mm, 40*mm, 30*mm, 30*mm, 30*mm] if (show_price and is_member) else [100*mm, 40*mm, 40*mm]
        t = Table(table_data, colWidths=col_widths)
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), HexColor(BRAND_HEX)),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (2, 1), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor(GRAY_HEX)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor(LIGHT_GRAY_HEX)]),
        ]
        if show_price and is_member:
            style_cmds.append(("FONTSIZE", (0, -1), (-1, -1), 11))
            style_cmds.append(("BACKGROUND", (0, -1), (-1, -1), HexColor("#E8EDF2")))
        t.setStyle(TableStyle(style_cmds))
        story.append(t)

    story.append(PageBreak())

    # ===== 商家信息 =====
    story.append(Paragraph("商家信息与售后保障", heading_style))
    if is_member and store.get("store_name"):
        info = [
            f"门店名称: {store.get('store_name', '')}",
            f"联系电话: {store.get('phone', '')}",
            f"门店地址: {store.get('address', '')}",
        ]
        for line in info:
            story.append(Paragraph(line, body_style))
    else:
        story.append(Paragraph("🔓 升级为付费会员，展示您的品牌信息、联系方式与门店地址", upgrade_style))
    story.append(PageBreak())

    # ===== 签字区 =====
    story.append(Paragraph("客户确认签字", heading_style))
    story.append(Spacer(1, 20*mm))
    story.append(Paragraph(
        "本人已确认上述铺贴方案、材料清单及费用明细（如有），同意按此方案进行施工。", body_style
    ))
    story.append(Spacer(1, 20*mm))
    story.append(Paragraph("客户签字：________________　　　日期：____年____月____日", body_style))
    story.append(Spacer(1, 15*mm))
    story.append(Paragraph("设计师签字：________________　　　日期：____年____月____日", body_style))
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph("本方案由排砖宝 TileLayout AI 生成 | www.tilelayout.ai", small_style))

    doc.build(story)
    buf.seek(0)
    return buf
