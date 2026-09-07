import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

# Safe defaults config
CONFIG = {
    "MAX_PIXELS": 15_000_000, # 15 MP limit to prevent memory exhaustion
    "UPSCALE_FACTOR": 2.0,
    "CLAHE_CLIP_LIMIT": 2.0,
    "CLAHE_TILE_GRID": (8, 8),
    "SHARPEN_KERNEL": np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32),
    "DENOISE_H": 10,
    "BLOCK_SIZE": 11,
    "C_CONSTANT": 2
}

def preprocess_image(image: np.ndarray, variant: str) -> np.ndarray:
    """Applies preprocessing variants without replacing original"""
    if variant == "original":
        return image
        
    try:
        if variant == "grayscale":
            return _grayscale(image)
        elif variant == "upscale":
            return _upscale(image)
        elif variant == "contrast":
            return _contrast(image)
        elif variant == "sharpen":
            return _sharpen(image)
        elif variant == "denoise":
            return _denoise(image)
        elif variant == "adaptive_threshold":
            return _adaptive_threshold(image)
        elif variant == "combined":
            return _combined(image)
        else:
            logger.warning(f"Unknown variant '{variant}', returning original")
            return image
    except Exception as e:
        logger.error(f"Preprocessing failed for variant '{variant}': {str(e)}")
        # Fail safe to original if preprocessing crashes
        return image

def _grayscale(img):
    if len(img.shape) == 3:
        # Return as 3 channel so paddleOCR standard input doesn't break
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    return img

def _upscale(img):
    h, w = img.shape[:2]
    new_w = int(w * CONFIG["UPSCALE_FACTOR"])
    new_h = int(h * CONFIG["UPSCALE_FACTOR"])
    
    if (new_w * new_h) > CONFIG["MAX_PIXELS"]:
        logger.warning(f"Upscale skipped: {new_w}x{new_h} exceeds {CONFIG['MAX_PIXELS']} max pixels")
        return img
        
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

def _contrast(img):
    if len(img.shape) == 3:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=CONFIG["CLAHE_CLIP_LIMIT"], tileGridSize=CONFIG["CLAHE_TILE_GRID"])
        cl = clahe.apply(l_channel)
        limg = cv2.merge((cl, a, b))
        return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    else:
        clahe = cv2.createCLAHE(clipLimit=CONFIG["CLAHE_CLIP_LIMIT"], tileGridSize=CONFIG["CLAHE_TILE_GRID"])
        return clahe.apply(img)

def _sharpen(img):
    return cv2.filter2D(img, -1, CONFIG["SHARPEN_KERNEL"])

def _denoise(img):
    if len(img.shape) == 3:
        return cv2.fastNlMeansDenoisingColored(img, None, CONFIG["DENOISE_H"], CONFIG["DENOISE_H"], 7, 21)
    return cv2.fastNlMeansDenoising(img, None, CONFIG["DENOISE_H"], 7, 21)

def _adaptive_threshold(img):
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
        
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 
        CONFIG["BLOCK_SIZE"], CONFIG["C_CONSTANT"]
    )
    return cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

def _combined(img):
    # grayscale -> upscale -> contrast enhancement -> sharpening
    img_gray = _grayscale(img)
    img_up = _upscale(img_gray)
    img_contrast = _contrast(img_up)
    return _sharpen(img_contrast)
