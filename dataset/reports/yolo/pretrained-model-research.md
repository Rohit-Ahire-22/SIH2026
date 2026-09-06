# Pretrained Model Research for YOLO ROI

This report documents the research into existing pretrained Object Detection and Text Localization models that might reduce our YOLO training requirements.

## Candidate Models

### 1. YOLOv8 (Ultralytics Pretrained on COCO)
- **Source**: Ultralytics GitHub
- **License**: AGPL-3.0 (Commercial requires Enterprise License)
- **Base Dataset**: COCO (Common Objects in Context)
- **Known Classes**: 80 generic objects (person, car, bottle, cup, etc.)
- **Expected Suitability**: `LOW`. While YOLOv8 is an incredibly powerful architectural choice, the COCO dataset knows nothing about legal declaration panels or principal display regions. It might recognize a "bottle" but will not recognize the boundaries of the ingredients list.

### 2. PaddleOCR PP-OCRv6 Text Detection Models
- **Source**: PaddlePaddle / PaddleOCR GitHub
- **License**: Apache 2.0 (Permissive, commercial use allowed)
- **Base Dataset**: ICDAR and large scale synthetic/web text datasets.
- **Known Classes**: `text_region`
- **Expected Suitability**: `MODERATE`. We are already using PaddleOCR. The text detection stage accurately draws bounding boxes around generic text lines. However, it cannot conceptually group "this cluster of 15 text boxes constitutes a single legal declaration panel." 

### 3. LayoutLM / Document AI Models
- **Source**: HuggingFace / Microsoft
- **License**: MIT / Apache 2.0
- **Base Dataset**: Document layouts (receipts, forms, PDFs)
- **Expected Suitability**: `LOW to MODERATE`. These models excel at extracting structure from flat, scanned documents. Packaging, however, involves curved surfaces, glare, complex graphic design, and chaotic backgrounds, which severely degrades standard Document AI pipelines without extensive fine-tuning.

## Pretrained vs. SIH-Specific Knowledge
A clear distinction exists:
- **Pretrained Knowledge**: Models know how to draw boxes around generic text, logos, or solid objects.
- **SIH-Specific Knowledge**: We explicitly need to detect the bounding region for `principal_display_panel` (brand identity) and `declaration_panel` (the clustered zone of legal dates, weights, and MRP). 

## Conclusion
We **cannot** simply download a generic YOLO model and expect it to isolate legal declaration panels. We must train a custom model. To bootstrap that custom model without 5,000 manual clicks, we must rely on a hybrid architecture: use PaddleOCR to find text, use deterministic Regex logic to find legal keywords, and group them spatially to create **Weak Supervision ROI Candidates**.
