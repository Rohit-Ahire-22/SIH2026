# AI Service: Training Lifecycle Foundation

This directory establishes the foundation for model training and fine-tuning pipelines. Currently, no custom models are trained. The system uses baseline zero-shot/foundational models. 

## Training Lifecycle
When sufficient data is collected via the deployed application, the pipeline will follow this progression:

1. **Raw Images:** User captures new front/back images.
2. **Annotation:** Images sit in `pending` state until reviewed. Admins annotate bounding boxes and OCR fields.
3. **Annotation Validation:** Annotations are verified for correctness.
4. **Dataset Versioning:** A new snapshot (e.g., `dataset-v2`) is created.
5. **Product-Level Split:** The dataset is split into `train`, `validation`, and `test` strictly at the *product level* to avoid data leakage (front and back of the same product must remain together).
6. **Training:** Models (YOLO for package detection, PaddleOCR fine-tuning if necessary) are trained on the new dataset version.
7. **Validation & Test:** Models are evaluated on the held-out test splits.
8. **Model Artifact:** The resulting model weights are saved to `ai-service/models/trained/`.
9. **Model Registry:** The new model version is registered in `ai-service/models/registry/model-registry.json`.
10. **Promotion / Rollback:**
    - If the new model performs better on E2E metrics than the currently active model, it is **promoted**.
    - If it performs worse, it is **rejected**, and the system continues using the active model. Never overwrite older model versions.

## Future Models
- **YOLO Package Detector:** Bounding box detection for `product_package`, `principal_display_panel`, `barcode`, etc.
- **OCR Engine:** Custom fine-tuned recognition model if standard OCR fails on specific Indian Legal Metrology fonts.
