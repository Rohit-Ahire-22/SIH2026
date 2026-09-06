import threading

import cv2
import numpy as np
from paddleocr import PaddleOCR

_lock = threading.Lock()
_inference_lock = threading.Lock()
_ocr = None


def get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        with _lock:
            if _ocr is None:
                _ocr = PaddleOCR(
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    enable_mkldnn=False,
                )
    return _ocr


from app.services.image_preprocessing import preprocess_image

def run_ocr(image_bytes: bytes, variant: str = "original") -> list[dict]:
    image = cv2.imdecode(
        np.frombuffer(image_bytes, dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )
    if image is None:
        raise ValueError("Unable to decode image")

    # Apply preprocessing pipeline
    processed_image = preprocess_image(image, variant)

    ocr = get_ocr()
    with _inference_lock:
        result = ocr.predict(processed_image)

    detections = []
    if not result:
        return detections

    for page in result:
        texts = _as_list(page["rec_texts"])
        scores = _as_list(page["rec_scores"])
        boxes = _as_list(page["rec_boxes"])
        for text, score, box in zip(texts, scores, boxes):
            detections.append(
                {
                    "text": str(text),
                    "confidence": float(score),
                    "bbox": to_bbox(box),
                }
            )
    return detections


def to_bbox(box) -> list[list[float]]:
    points = np.asarray(box, dtype=float)
    if points.size == 4:
        x1, y1, x2, y2 = points.reshape(-1).tolist()
        return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    return [[float(x), float(y)] for x, y in points.reshape(-1, 2)]


def _as_list(value):
    if value is None:
        return []
    if hasattr(value, "tolist"):
        return value.tolist()
    return list(value)