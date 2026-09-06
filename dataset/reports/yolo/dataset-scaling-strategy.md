# YOLO Dataset Scaling Strategy

This report analyzes how to safely scale the proprietary dataset from 20 images to a YOLO-trainable size while minimizing the manual burden on annotators.

## Current Context
- **10 weak candidates** exist.
- Verifying 10 candidates does *not* produce enough seed data to train YOLOv8. 
- A robust baseline requires at least 100 unique products (200 front/back images) strictly for training, plus held-out sets.

## Evaluated Strategies

### Strategy A: Pure Manual Annotation
- **Effort**: Extremely High.
- **Risk**: Low.
- **Viability**: Unlikely for a fast-paced SIH project without a dedicated data team.

### Strategy B: Weak Supervision + Manual Verification
- **Effort**: Low per-image, but requires physically capturing/sourcing 100+ unique proprietary products first.
- **Risk**: Low (Highly defensible).
- **Viability**: High. We use OCR to propose the box, human just clicks "Save".

### Strategy C: External Datasets + Weak Supervision + Verification
- **Effort**: Moderate.
- **Risk**: High (Open Food Facts lacks specific legal bounding boxes; mapping generic "packages" doesn't help detect "declaration panels").
- **Viability**: Moderate. Only useful for `product_package` (Class 0).

### Strategy D: Hybrid OCR/Geometry (No YOLO Training)
- **Effort**: Zero annotation effort.
- **Risk**: Low.
- **Viability**: High. Instead of training YOLO, we rely purely on the geometric output of `weakRoiCandidateService` at inference time. If no candidate is generated, we fallback to full-image OCR.

## Recommended Scaling Path
**Phase 1: Adopt Strategy D immediately.** The current architecture gracefully degrades: YOLO (if available) -> OCR Weak Candidate ROI -> Full Image OCR.
**Phase 2: Target Strategy B for long-term improvement.** As users scan real products via the app, run the weak supervision module to store candidates. Periodically, an admin verifies them, growing the dataset organically until it breaches the 200-image training threshold.

## Data Roles & Provenance Rules
1. **TEST SET**: Must *only* contain `proprietary_human_verified`. Never `weak_candidate` or `synthetic`.
2. **VALIDATION SET**: Must *only* contain `proprietary_human_verified`.
3. **TRAIN SET**: May contain `synthetic` augmentations and `external_human_annotation`, but must never leak products from Validation/Test.
