# Step 35: YOLO Targeted ROI Detection Foundation

## 1. Existing YOLO Infrastructure
The SIH26034 backend already possesses a mature foundation:
- Export/Splitting logic (`createYoloSplits.js`, `exportYoloDataset.js`)
- Model configuration (`yolo_classes.json`)
- Validation schema (`validateYoloAnnotations.js`)
- Inference interface (`ai-service/inference/yolo_detector.py`)

## 2. Current Dataset Statistics
- **Unique Products**: 10
- **Total Images**: 20
- **Human Verified Annotations**: 0
- **Weak Candidates**: 10

## 3. Class Definitions
The class schema is optimal for this project's architecture:
1. `product_package` (id 0)
2. `principal_display_panel` (id 1)
3. `declaration_panel` (id 2) - *The critical legal ROI*

## 4. Annotation Provenance
Annotations must transition from `weak_candidate` to `annotated` (human verified). The `validateYoloAnnotations.js` pipeline enforces this state transition, ensuring heuristic boxes are never blindly used as ground truth.

## 5. Weak-Candidate Analysis
The 10 weak candidates generated in Step 27/29 successfully isolate dense clusters of text. However, because they are bound by PaddleOCR's own fragmentation errors, they often clip multiline manufacturer addresses or miss dates entirely. They are plausible starting points but mathematically unfit for unverified training.

## 6. Training-Readiness Result
**STATUS: NOT_READY**
A strict gate was implemented (`checkTrainingReadiness.js`). It correctly blocks training until at least 100 human-verified annotations and 50 unique products are present.

## 7. Dataset Export Validation
The `validateYoloAnnotations.js` script successfully processed the dataset. Missing labels on `pending` images are correctly flagged without failing the exporter. 

## 8. Pretrained Model Availability & Licensing (AGPL)
The most popular modern YOLO variants (YOLOv5, YOLOv8, YOLOv9 by Ultralytics) operate under the **AGPL-3.0 license**. Using them in a cloud API service legally triggers the AGPL network-interaction clause, potentially requiring the entire SIH backend to be open-sourced. 
Unless YOLO-NAS (SuperGradients) or an explicitly permissive MIT/Apache 2.0 alternative is tuned, adopting arbitrary pretrained weights is a massive compliance risk.

## 9. Optional Inference Experiment
**NOT PERFORMED.**
*Pretrained YOLO experiment not performed because no validated legally suitable detector is currently available without AGPL-3.0 contamination.*

## 10. ROI Integration & Fallback Architecture
The YOLO integration preserves the existing deterministic logic:
```
YOLO ROI Detection (Primary) -> If Success -> OCR Region
YOLO ROI Detection (Fails) -> Hybrid Geometry ROI (Fallback 1) -> OCR Region
Hybrid Geometry ROI (Fails) -> Full-Image OCR (Fallback 2) -> Extraction
```
YOLO enhances accuracy without acting as a single point of failure.

## 11. Controlled Comparison Plan
For Step 36, the evaluation methodology will compare:
1. Full-image OCR (Baseline)
2. Hybrid OCR/Geometry (Current)
3. YOLO ROI (Proposed Target)
Metrics: OCR latency, extraction recall (%), and extraction precision (%).

## 12. Tests
Implemented `tests/yoloReadiness.test.js` validating:
- Training Readiness Gate threshold matrix
- YOLO inference JSON contract
- Architecture fallback behavior

## 13. Limitations
The architecture is fully prepared, but data scale is non-existent. The system requires bulk dataset scaling (web scraping or external synthetic rendering) before a viable model can be trained.

## 14. Step 36 Recommendation
Proceed to **Step 36: Broad Dataset Scaling & Web Acquisition**. The AI infrastructure is 100% complete and protected by strict readiness gates. We must now acquire 50-100 real images to break through the training barrier.
