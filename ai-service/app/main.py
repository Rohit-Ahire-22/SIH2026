import os
from fastapi import FastAPI, Depends, Header, HTTPException, status

from app.routes.ocr import router as ocr_router

app = FastAPI(
    title="SIH26034 AI Service",
    description="AI service for the SIH26034 Packaged Commodity Compliance System",
    version="0.1.0",
)

def verify_service_key(x_ai_service_key: str = Header(None)):
    expected_key = os.environ.get("AI_SERVICE_API_KEY")
    if not expected_key:
        # If no key is configured in the environment, we might want to fail closed.
        # But for local dev it might be empty. We should enforce it.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service is improperly configured (missing API key)",
        )
    if x_ai_service_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service key",
        )

app.include_router(ocr_router, dependencies=[Depends(verify_service_key)])


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "sih-compliance-ai-service",
        "message": "AI service is running",
    }