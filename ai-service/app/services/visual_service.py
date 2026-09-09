import logging

logger = logging.getLogger(__name__)

def run_visual_detection(image_bytes: bytes) -> dict:
    """
    Simulates the visual detection process.
    Currently, there are no trained PDP detection models in the registry.
    This function gracefully returns a NOT_READY/REVIEW-safe state
    to prevent the compliance engine from failing or fabricating data.
    """
    logger.info("Visual detection requested, but no trained model is available.")
    
    return {
        "inferenceStatus": "UNAVAILABLE_MODEL_MISSING",
        "detector": "yolo",
        "model": "yolo11n-pdp",
        "modelVersion": "none",
        "detections": []
    }
