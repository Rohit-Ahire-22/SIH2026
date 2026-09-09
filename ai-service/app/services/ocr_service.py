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

def _get_ai_max_dim() -> int:
    """Return the configurable maximum image dimension (default 2048).

    Falls back to 2048 if the AI_MAX_DIM environment variable is unset,
    invalid, or not a positive integer.
    """
    raw = os.environ.get("AI_MAX_DIM", "")
    if not raw:
        logger.info("AI_MAX_DIM not set. Using default 2048.")
        return 2048
    try:
        value = int(raw)
    except (TypeError, ValueError):
        logger.warning(f"Invalid AI_MAX_DIM '{raw}'. Falling back to 2048.")
        return 2048
    if value <= 0:
        logger.warning(f"AI_MAX_DIM {value} out of range. Falling back to 2048.")
        return 2048
    return value


def run_ocr(image_bytes: bytes, variant: str = "original") -> list[dict]:
    with _inference_lock:
        t_start = time.time()
        image = cv2.imdecode(
            np.frombuffer(image_bytes, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )
        if image is None:
            raise ValueError("Unable to decode image")
            
        original_h, original_w = image.shape[:2]
        max_dim = _get_ai_max_dim()
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
        processed_h, processed_w = processed_image.shape[:2]

        # Total scale from the ORIGINAL image to the image actually fed to OCR.
        # This accounts for the downscale above AND any dimension-changing
        # preprocessing (e.g. the "upscale" / "combined" variants).
        # Fall back to scale_factor if a dimension is unexpectedly zero.
        scale_x = (processed_w / original_w) if original_w > 0 else scale_factor
        scale_y = (processed_h / original_h) if original_h > 0 else scale_factor

        ocr = get_ocr()
        detections = []
        result = None
        
        mem_before = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
        logger.info(f"OCR inference start. Process RAM: {mem_before:.1f}MB")
        t_inf_start = time.time()
        
        try:
            result = ocr.predict(processed_image)
        except MemoryError as e:
            logger.exception("OCR inference failed: out of memory")
            # MemoryError is potentially recoverable; return empty detections
            # instead of crashing the FastAPI worker. Do not expose details to the client.
            return []
        except Exception:
            # Any other failure should NOT be silently treated as a successful
            # empty OCR result. Log the full traceback server-side only.
            logger.exception("OCR inference failed with an unexpected error")
            raise
            
        t_inf_end = time.time()
        mem_after = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
        logger.info(f"OCR inference end. Took {t_inf_end - t_inf_start:.2f}s. Process RAM: {mem_after:.1f}MB")

        if not result:
            return detections

        for page in result:
            if not isinstance(page, dict):
                continue
                
            texts = _as_list(page.get("rec_texts", []))
            scores = _as_list(page.get("rec_scores", []))
            boxes = _as_list(page.get("rec_boxes", []))
            
            # Ensure we iterate up to the maximum length to catch mismatches if they occur
            max_len = max(len(texts), len(scores), len(boxes))
            
            for i in range(max_len):
                try:
                    # Safely get items or None if out of bounds
                    text = texts[i] if i < len(texts) else None
                    score = scores[i] if i < len(scores) else None
                    box = boxes[i] if i < len(boxes) else None

                    if text is None or str(text).strip() == "":
                        logger.warning(f"Skipping detection {i}: missing or empty text")
                        continue
                        
                    if score is None:
                        logger.warning(f"Skipping detection {i}: missing confidence score")
                        continue
                        
                    try:
                        confidence = float(score)
                    except (ValueError, TypeError):
                        logger.warning(f"Skipping detection {i}: malformed confidence score '{score}'")
                        continue
                        
                    if box is None or len(box) == 0:
                        logger.warning(f"Skipping detection {i}: missing or empty bbox")
                        continue
                        
                    bbox = to_bbox(box)
                    
                    # Map bounding box from the processed/OCR coordinate space
                    # back to the ORIGINAL image coordinate space. Using the
                    # processed-to-original dimension ratio is exact for the
                    # downscale AND any dimension-changing preprocessing.
                    if scale_x != 1.0 or scale_y != 1.0:
                        bbox = [[x / scale_x, y / scale_y] for x, y in bbox]
                        
                    detections.append(
                        {
                            "text": str(text),
                            "confidence": confidence,
                            "bbox": bbox,
                        }
                    )
                except Exception as e:
                    logger.warning(f"Skipping detection {i}: malformed data - {str(e)}")
                    continue
                
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