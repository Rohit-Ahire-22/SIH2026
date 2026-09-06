import threading
import logging
import time

import cv2
import numpy as np
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_inference_lock = threading.Lock()
_ocr = None


def get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        with _lock:
            if _ocr is None:
                logger.info("Model initialization start")
                t0 = time.time()
                _ocr = PaddleOCR(
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    enable_mkldnn=False,
                )
                t1 = time.time()
                logger.info(f"Model initialization end. Took {t1 - t0:.2f}s")
    return _ocr

def initialize_ocr():
    # Eagerly initialize the model
    get_ocr()


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
        logger.info("OCR inference start")
        t_inf_start = time.time()
        result = ocr.predict(processed_image)
        t_inf_end = time.time()
        logger.info(f"OCR inference end. Took {t_inf_end - t_inf_start:.2f}s")

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