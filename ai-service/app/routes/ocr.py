from fastapi import APIRouter, File, HTTPException, UploadFile, Form

from app.services.ocr_service import run_ocr

router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/ocr")
def ocr_image(
    image: UploadFile = File(...),
    variant: str = Form("original")
) -> dict:
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
        results = run_ocr(contents, variant=variant)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="OCR processing failed") from exc

    return {
        "success": True,
        "count": len(results),
        "results": results,
    }