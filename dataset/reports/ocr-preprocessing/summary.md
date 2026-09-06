# Preprocessing Experiment (Step 25)

## Baseline Comparison

| Variant | Successful Images | OCR Detections | Avg Confidence | Field Coverage | Avg Latency |
|---|---|---|---|---|---|
| original | 2 | 95 | 0.7307 | 0 | 41931 ms |
| grayscale | 2 | 96 | 0.7252 | 0 | 75491 ms |
| upscale | 1 | 11 | 0.8065 | 0 | 364909 ms |
| contrast | 1 | 13 | 0.8211 | 0 | 221737 ms |
| sharpen | 1 | 13 | 0.7824 | 0 | 82650 ms |
| denoise | 1 | 9 | 0.8377 | 0 | 87019 ms |
| adaptive_threshold | 1 | 12 | 0.8565 | 0 | 81483 ms |
| combined | 2 | 95 | 0.7183 | 0 | 94884 ms |

## Recommendation
**Best Variant:** original
Determined using a multi-factor score balancing extracted fields, confidence, and latency.

> **Note:** Step 25 provides the preprocessing benchmark that will be used before introducing YOLO ROI detection and eventual model training.
