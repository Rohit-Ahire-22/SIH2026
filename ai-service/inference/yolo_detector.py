import json
import os
import logging
import numpy as np

logger = logging.getLogger(__name__)

REGISTRY_PATH = os.path.join(
    os.path.dirname(__file__),
    "../models/registry/model-registry.json"
)

class YoloDetector:
    def __init__(self):
        self.model_version = self._get_active_model_version()
        # In a real scenario, we would load the ultralytics model here.
        # self.model = YOLO(f"weights/{self.model_version}.pt") if self.model_version else None

    def _get_active_model_version(self) -> str | None:
        try:
            with open(REGISTRY_PATH, 'r') as f:
                registry = json.load(f)
                return registry.get("activeModels", {}).get("package-detector", None)
        except Exception as e:
            logger.warning(f"Could not load model registry: {e}")
            return None

    def detect(self, image: np.ndarray) -> dict:
        """
        Inference interface for future YOLO detections.
        Contract:
        - success: boolean
        - status: "success" | "model_unavailable" | "not_implemented"
        - modelVersion: string or null
        - imageWidth: integer (width of the image processed)
        - imageHeight: integer (height of the image processed)
        - detections: array of objects containing:
            - classId: integer (0=product_package, 1=principal_display_panel, 2=declaration_panel)
            - className: string
            - confidence: float (0.0 to 1.0)
            - x1, y1, x2, y2: integer coordinates (absolute pixel values)
        """
        if not self.model_version:
            return {
                "success": False,
                "status": "model_unavailable",
                "modelVersion": None,
                "imageWidth": image.shape[1] if image is not None else 0,
                "imageHeight": image.shape[0] if image is not None else 0,
                "detections": []
            }
            
        # Stub for future implementation
        return {
             "success": False,
             "status": "not_implemented",
             "modelVersion": self.model_version,
             "imageWidth": image.shape[1] if image is not None else 0,
             "imageHeight": image.shape[0] if image is not None else 0,
             "detections": []
        }
