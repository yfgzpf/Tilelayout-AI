"""
水印服务

免费版导出的 PDF/PPT 添加平台水印
"""
from PIL import Image, ImageDraw, ImageFont
import io
import os


WATERMARK_TEXT = "排砖宝 TileLayout AI"
WATERMARK_UPGRADE = "升级会员去除水印"
WATERMARK_COLOR = (128, 128, 128, 60)
WATERMARK_FONT_SIZE_RATIO = 0.04


def add_image_watermark(
    image_bytes: bytes,
    text: str = WATERMARK_TEXT,
    upgrade_text: str = WATERMARK_UPGRADE,
    opacity: int = 60,
) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    w, h = img.size
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font_size = max(12, int(min(w, h) * WATERMARK_FONT_SIZE_RATIO))

    try:
        font = ImageFont.truetype("arial.ttf", font_size)
        font_small = ImageFont.truetype("arial.ttf", max(10, font_size - 8))
    except Exception:
        font = ImageFont.load_default()
        font_small = ImageFont.load_default()

    text_color = (*WATERMARK_COLOR[:3], opacity)

    step_x = int(w / 3)
    step_y = int(h / 2)
    for y in range(int(h / 4), int(h * 3 / 4), step_y):
        for x in range(-int(w / 4), int(w * 5 / 4), step_x):
            draw.text((x, y), text, fill=text_color, font=font)

            draw.text(
                (x, y + font_size + 4),
                upgrade_text,
                fill=(*WATERMARK_COLOR[:3], max(30, opacity - 30)),
                font=font_small,
            )

    result = Image.alpha_composite(img, overlay)
    buf = io.BytesIO()
    result = result.convert("RGB")
    result.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf.getvalue()


def add_pdf_watermark(
    pdf_bytes: bytes,
    text: str = WATERMARK_TEXT,
) -> bytes:
    return pdf_bytes


def should_add_watermark(is_member: bool) -> bool:
    return not is_member
