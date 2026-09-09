import time
import logging
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.visual_service import run_visual_detection

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/detect")
def detect_visual(
    image: UploadFile = File(...)
) -> dict:
    t0 = time.time()
    logger.info("Visual detection request received")
    
    if not image or not image.filename:
        raise HTTPException(status_code=400, detail="No image file uploaded")

    content_type = image.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported content type '{content_type}'. "
                "Supported types: JPEG, PNG, WEBP, BMP."
            ),
        )

    contents = image.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Image exceeds the maximum allowed size of 10 MB",
        )

    try:
        result = run_visual_detection(contents)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Visual processing failed") from exc

    t_total = time.time()
    logger.info(f"Total visual request duration: {t_total - t0:.2f}s")
    
    return result
