# YOLO Training Readiness Report

This document reports on the current statistical viability of training a custom YOLOv8 model for SIH26034 Legal Metrology ROI Detection.

## Dataset Volume
- **Total Products**: 10
- **Total Images**: 20
- **Images with Human Verification**: 0
- **Images with Weak Candidates Generated**: 10 (Back panels)

## Provenance Breakdown
- `human_verified`: 0%
- `weak_candidate`: 100% (of generated labels)
- `external_dataset`: 0%

## Class Distribution (Weak Candidates Only)
- `product_package` (Class 0): 0 annotations (Not mapped in the weak experiment yet)
- `principal_display_panel` (Class 1): 0 annotations (Front panels lacked enough keyword evidence)
- `declaration_panel` (Class 2): 10 annotations (All generated from back panel keyword clusters)

## Class Imbalance
Extremely high. The current weak supervision prototype focuses entirely on the `declaration_panel`. A production weak-supervision run would need to add heuristics for `product_package` (perhaps drawing a box around the largest contiguous geometric hull of the image subject) and `principal_display_panel`.

## Training Suitability Score
**Status**: NOT READY (0/10)

**Reasoning**:
1. 20 images total is mathematically insufficient to train a modern object detector without catastrophic overfitting, regardless of data augmentation.
2. 0 human-verified annotations exist. We cannot validate model accuracy without a clean human-verified test set.
3. Class imbalance is severe.

## Path to Readiness (Step 28)
1. **Scale Dataset**: The proprietary dataset must be artificially or physically scaled from 20 to at least 1,000 images.
2. **Batch Weak Supervision**: Run the `weakRoiCandidateService` against the scaled dataset.
3. **Human Review**: Use a tool like LabelImg to load the `weak_candidates` and quickly adjust/save them as `human_verified` ground truth in `annotations/yolo/labels/`.
4. **Train**: Once we have ~800 Train images and ~200 Validation images across all 3 classes, YOLOv8 fine-tuning will be viable.
