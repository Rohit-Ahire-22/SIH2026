# Proprietary Dataset Pipeline Documentation

## 1. Core Principles
The deployed application must be capable of continuously collecting new images, retaining them as candidate training data, supporting annotation and dataset versioning, and later fine-tuning/evaluating/versioning models as the dataset grows. Today's 20-image dataset is simply the `dataset-v1` baseline.

## 2. Directory Architecture & Raw Data Policy
```text
dataset/
├── raw/
│   ├── proprietary/    <-- Canonical source for project-owned images
│   │   ├── product_001/
│   │   │   ├── front.jpeg
│   │   │   └── back.jpeg
│   │   └── ...
```
- **Immutable Originals:** Raw images in `dataset/raw/proprietary` must NEVER be resized, compressed, or overwritten.
- **Dynamic Scale:** The architecture dynamically discovers any valid product directories (e.g., `product_500`). It does not hard-code limits.

## 3. Post-Deployment Data Collection
**The application can use newly captured images for inference immediately, but those images should not automatically become training data until reviewed/annotated.**
When a user uploads a new image, the `datasetIngestionService.js` creates a unique ID, hashes the image for exact duplicate detection, evaluates near-duplicates (using perceptual hashing), and logs advisory quality metrics (sharpness, contrast, dimensions). The image is assigned:
- `annotationStatus = pending`
- `trainingEligible = false`
- `trainingStatus = candidate`

## 4. Annotation Lifecycle
1. **Pending:** New image awaiting review.
2. **Annotated:** Admin applies bounding boxes (package, barcode) and OCR field regions.
3. **Validated:** Annotations are approved.
4. **Training Eligible:** The image is marked ready for the next dataset version split.

## 5. Dataset Versioning & Product-Level Splitting
When enough validated images exist, a new dataset snapshot is created (e.g., `dataset-v2`).
- **Splitting:** Dataset splitting (`train`, `validation`, `test`) is performed strictly at the **Product Level**. This guarantees that a product's front and back views are always in the same split, avoiding data leakage.

## 6. Training & Model Promotion
- **Registry:** Models are registered in `ai-service/models/registry/model-registry.json`.
- **Promotion / Rollback:** After training a new candidate model on `dataset-v2`, it is evaluated on the test split. If metrics improve over the active model, the new model is **promoted**. If it fails to outperform, it is **rejected**, and the previous model remains active (rollback capability).

## 7. Why 10 Products Are Insufficient for ML Training
The current 10 products (20 images) serve merely as an engineering integration baseline to build out this pipeline. True deep learning models (like YOLO or fine-tuned text recognition) require hundreds to thousands of varied examples to learn generalizable features rather than just memorizing the 10 training instances. By building this pipeline, we ensure that as the data scales to 50, 100, and 500+ products, the infrastructure is already fully capable of handling it without requiring any source code modifications.
