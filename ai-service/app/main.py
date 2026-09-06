import os
# Force PaddleOCR/OpenMP to use a single thread to prevent CPU starvation on Render Free
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Header, HTTPException, status

from app.routes.ocr import router as ocr_router
from app.services.ocr_service import initialize_ocr

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_ocr()
    yield

app = FastAPI(
    title="SIH26034 AI Service",
    description="AI service for the SIH26034 Packaged Commodity Compliance System",
    version="0.1.0",
    lifespan=lifespan,
)

import logging
logger = logging.getLogger(__name__)

def verify_service_key(x_ai_service_key: str = Header(None)):
    expected_key = os.environ.get("AI_SERVICE_API_KEY")
    if not expected_key:
        logger.error("API-key validation: FAIL (no expected key)")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service is improperly configured (missing API key)",
        )
    if x_ai_service_key != expected_key:
        provided_len = len(x_ai_service_key) if x_ai_service_key else 0
        expected_len = len(expected_key) if expected_key else 0
        logger.error(
            f"API-key validation: FAIL (mismatch). "
            f"Provided length: {provided_len}, Expected length: {expected_len}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service key",
        )
    logger.info("API-key validation: PASS")

app.include_router(ocr_router, dependencies=[Depends(verify_service_key)])


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "sih-compliance-ai-service",
        "message": "AI service is running",
    }