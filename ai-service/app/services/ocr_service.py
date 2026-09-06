import threading
import logging
import time
import os
import psutil

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
                # Use lighter default models by specifying lang and disabling heavy features
                _ocr = PaddleOCR(
                    lang="en",
                    ocr_version="PP-OCRv4",
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    enable_mkldnn=False,
                )
                t1 = time.time()
                mem = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
                logger.info(f"Model initialization end. Took {t1 - t0:.2f}s, Memory: {mem:.1f}MB")
    return _ocr

def initialize_ocr():
    # Eagerly initialize the model
    get_ocr()


from app.services.image_preprocessing import preprocess_image

def run_ocr(image_bytes: bytes, variant: str = "original") -> list[dict]:
    t_start = time.time()
    image = cv2.imdecode(
        np.frombuffer(image_bytes, dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )
    if image is None:
        raise ValueError("Unable to decode image")
        
    original_h, original_w = image.shape[:2]
    max_dim = 1024
    scale_factor = 1.0
    
    # Downscale image to prevent OOM on 512MB Render instances
    if max(original_h, original_w) > max_dim:
        scale_factor = max_dim / max(original_h, original_w)
        new_w = int(original_w * scale_factor)
        new_h = int(original_h * scale_factor)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        logger.info(f"Downscaled image from {original_w}x{original_h} to {new_w}x{new_h} (scale: {scale_factor:.3f})")

    # Apply preprocessing pipeline
    processed_image = preprocess_image(image, variant)

    ocr = get_ocr()
    detections = []
    result = None
    
    with _inference_lock:
        mem_before = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
        logger.info(f"OCR inference start. Process RAM: {mem_before:.1f}MB")
        t_inf_start = time.time()
        
        try:
            result = ocr.predict(processed_image)
        except Exception as e:
            logger.error(f"OCR inference failed gracefully: {str(e)}")
            # Return empty detections instead of crashing the FastAPI worker if it's a catchable MemoryError
            return []
            
        t_inf_end = time.time()
        mem_after = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
        logger.info(f"OCR inference end. Took {t_inf_end - t_inf_start:.2f}s. Process RAM: {mem_after:.1f}MB")

    if not result:
        return detections

    for page in result:
        texts = _as_list(page["rec_texts"])
        scores = _as_list(page["rec_scores"])
        boxes = _as_list(page["rec_boxes"])
        for text, score, box in zip(texts, scores, boxes):
            bbox = to_bbox(box)
            
            # Upscale bounding box back to original image coordinate space
            if scale_factor != 1.0:
                bbox = [[x / scale_factor, y / scale_factor] for x, y in bbox]
                
            detections.append(
                {
                    "text": str(text),
                    "confidence": float(score),
                    "bbox": bbox,
                }
            )
            
    logger.info(f"OCR complete. Found {len(detections)} texts in {time.time() - t_start:.2f}s total.")
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