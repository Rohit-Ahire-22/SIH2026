# Bounding Box Annotation-Aware Augmentation Policy

This policy dictates how the SIH proprietary dataset may be artificially scaled.

## 1. Product Identity Rule (CRITICAL)
- If `product_001.jpg` is augmented into 50 variations, the dataset STILL ONLY CONTAINS 1 UNIQUE PRODUCT.
- Augmentations do not inflate the unique product count in readiness reports.

## 2. Test/Validation Exclusion
- Augmentations may ONLY be applied to images assigned to the `TRAIN` split.
- `TEST` and `VAL` sets must remain untouched to guarantee real-world evaluation validity.

## 3. Allowed Transformations & Geometric Syncing
Whenever an image undergoes a spatial transformation, the YOLO bounding box `[x, y, w, h]` must be mathematically transformed alongside it.

| Transformation | Parameters | Purpose | Risk | Geometric Sync Required? |
|---|---|---|---|---|
| Mild Blur | Gaussian, kernel=3-5 | Simulates out-of-focus camera | Low | No |
| Brightness/Contrast | ±20% | Simulates lighting conditions | Low | No |
| JPEG Compression | quality=30-70 | Simulates app upload compression | Low | No |
| Small Rotation | ±5 degrees | Simulates skewed holding | Low | **YES** |
| Horizontal/Vertical Shift | ±10% | Simulates off-center framing | Low | **YES** |
| Scale/Zoom | ±15% | Simulates camera distance | Low | **YES** |

## 4. Forbidden Transformations
- **Aggressive Rotation (>10 degrees)**: Text becomes unreadable for OCR fallback.
- **Aggressive Cropping**: May slice a declaration panel in half, creating invalid bounding boxes.
- **Horizontal Flip**: Text becomes backwards, destroying OCR viability.

## 5. Provenance Tracking
Every augmented image must record:
- `sourceImageId`
- `sourceAnnotationVersion`
- `augmentationPipelineVersion`
- `augmentationParameters`
- `provenance = synthetic`
