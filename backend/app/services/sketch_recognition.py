"""
手绘户型识别服务

使用 OpenCV 进行轮廓提取 + 形状简化
可选 PaddleOCR 进行尺寸数字识别（当前使用阈值/边缘检测方案）
"""
import io
import math
from typing import List, Dict, Any, Tuple, Optional
import numpy as np


try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


class SketchRecognizer:
    """手绘户型草图识别器"""

    def __init__(self):
        if not HAS_CV2:
            raise ImportError(
                "OpenCV (cv2) 未安装, 请运行: pip install opencv-python-headless"
            )

    def preprocess(self, image_bytes: bytes) -> np.ndarray:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("无法解码图片, 请确认上传格式为 PNG/JPG")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel, iterations=1)

        return cleaned, img.shape[:2]

    def extract_contours(
        self, preprocessed: np.ndarray, min_area_ratio: float = 0.02
    ) -> List[np.ndarray]:
        contours, _ = cv2.findContours(
            preprocessed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            return []

        img_area = preprocessed.shape[0] * preprocessed.shape[1]
        min_area = img_area * min_area_ratio

        valid = [c for c in contours if cv2.contourArea(c) > min_area]
        valid.sort(key=cv2.contourArea, reverse=True)
        return valid

    def simplify_polygon(
        self, contour: np.ndarray, epsilon_factor: float = 0.02, target_vertices: int = 8
    ) -> List[List[float]]:
        peri = cv2.arcLength(contour, True)
        epsilon = epsilon_factor * peri

        for _ in range(10):
            approx = cv2.approxPolyDP(contour, epsilon, True)
            num_vertices = len(approx)
            if num_vertices <= target_vertices:
                break
            epsilon = min(epsilon * 1.3, peri * 0.05)

        epsilon = epsilon_factor * peri
        approx = cv2.approxPolyDP(contour, epsilon, True)

        points = [[float(p[0][0]), float(p[0][1])] for p in approx]
        return self._order_points_clockwise(points)

    def _order_points_clockwise(self, points: List[List[float]]) -> List[List[float]]:
        if not points:
            return points
        pts = np.array(points)
        center = pts.mean(axis=0)
        angles = [math.atan2(p[1] - center[1], p[0] - center[0]) for p in pts]
        sorted_pts = [p for _, p in sorted(zip(angles, points), key=lambda x: x[0])]
        return sorted_pts

    def fit_rectangle(self, points: List[List[float]]) -> Tuple[List[List[float]], float]:
        if len(points) < 4:
            return points, 0.0
        pts = np.array(points, dtype=np.float32)
        rect = cv2.minAreaRect(pts)
        box = cv2.boxPoints(rect)
        area_pts = cv2.contourArea(pts)
        area_box = cv2.contourArea(box)
        confidence = min(area_box / max(area_pts, 0.001), 2.0)
        confidence = max(0.0, min(1.0, 1.0 - abs(1.0 - confidence)))
        result = self._order_points_clockwise(
            [[float(p[0]), float(p[1])] for p in box]
        )
        return result, round(confidence, 2)

    def detect_dimensions(
        self, preprocessed: np.ndarray, original_shape: Tuple[int, int]
    ) -> List[Dict[str, Any]]:
        contours, _ = cv2.findContours(
            preprocessed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        h, w = original_shape

        dimensions = []
        for c in contours:
            x, y, cw, ch = cv2.boundingRect(c)
            aspect = cw / max(ch, 1)
            area = cw * ch
            img_area = h * w

            if 0.001 < area / img_area < 0.05 and 0.3 < aspect < 8:
                dimensions.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(cw),
                    "height": int(ch),
                    "estimated_length": int(max(cw, ch)),
                })

        return sorted(dimensions, key=lambda d: d["estimated_length"], reverse=True)[:10]

    def recognize(
        self,
        image_bytes: bytes,
        simplify: bool = True,
        fit_to_rectangle: bool = False,
    ) -> Dict[str, Any]:
        preprocessed, original_shape = self.preprocess(image_bytes)
        contours = self.extract_contours(preprocessed)
        dimensions = self.detect_dimensions(preprocessed, original_shape)

        if not contours:
            return {
                "success": True,
                "polygons": [],
                "dimensions": dimensions,
                "message": "未检测到完整户型轮廓, 请确认图片清晰度",
                "original_size": {"width": original_shape[1], "height": original_shape[0]},
            }

        polygons = []
        for c in contours[:3]:
            points = self.simplify_polygon(c)
            area = cv2.contourArea(c)
            rect_points = None
            rect_confidence = 0.0
            if fit_to_rectangle and len(points) >= 4:
                rect_points, rect_confidence = self.fit_rectangle(points)

            polygons.append({
                "vertices": points,
                "vertex_count": len(points),
                "area_px": float(area),
                "rect_fit": rect_points,
                "rect_confidence": rect_confidence,
                "is_primary": len(polygons) == 0,
            })

        return {
            "success": True,
            "polygons": polygons,
            "dimensions": dimensions,
            "message": f"检测到 {len(polygons)} 个候选轮廓",
            "original_size": {"width": original_shape[1], "height": original_shape[0]},
        }


def create_recognizer() -> SketchRecognizer:
    return SketchRecognizer()
