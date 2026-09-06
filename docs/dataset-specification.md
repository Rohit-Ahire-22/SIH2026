# SIH26034 Dataset Specification

## 1. Core Principle
This dataset specification enforces the architectural separation of concerns for the SIH26034 Legal Metrology compliance system:
- **YOLO / Computer Vision** detects structural layout regions (the package, the principal display panel).
- **OCR (PaddleOCR)** extracts text polygons and literal strings.
- **Deterministic Legal Rules** evaluate compliance based on structured context.
- **LLM / RAG** provides semantic explanations of verified legal requirements.

**CRITICAL:** The dataset MUST NOT train YOLO to determine legal compliance. YOLO identifies visual features; the deterministic rule engine determines if those features constitute compliance.

## 2. CV Task Breakdown
The computer vision pipeline is explicitly divided into specific tasks:

| Task | Component | Purpose |
|------|-----------|---------|
| **Product / Package Detection** | YOLO | Identifies if an image contains a packaged commodity (reduces false positives from posters, loose items). |
| **Declaration Panel Detection** | YOLO | Identifies the Principal Display Panel (PDP) and grouped declaration regions (essential for Rule 7 area math and Rule 9 grouping rules). |
| **Text Region Localization** | OCR (DBNet) | Locates bounding boxes/polygons of text lines. |
| **Text Recognition** | OCR (CRNN) | Transcribes text within bounding boxes. |
| **Geometric Evidence** | CV / Math | Calculates font sizes and text area percentages using OCR polygons relative to YOLO PDP bounding boxes. |
| **Image Quality Assessment** | OpenCV | Evaluates Laplacian variance (blur) and thresholding (glare) to flag images for manual review. |
| **Barcode / QR Detection** | YOLO / ZBar | Localizes standard barcodes (EAN-13, QR) for product lookup and GTIN resolution. |

## 3. Minimal YOLO Classes
To avoid class explosion and brittle training, we do **not** create classes for every legal declaration (e.g., no `mrp_region` or `date_region`).

| Class Name | Purpose | Why YOLO is Needed | Why OCR Cannot Handle It Alone | Annotation Type |
|------------|---------|--------------------|--------------------------------|-----------------|
| `product_package` | Bounding box of the physical packaged product. | To determine total package area (Rule 7) and isolate the product from background noise. | OCR detects text, not physical object boundaries. | Bounding Box |
| `principal_display_panel` | Bounding box of the front/main label. | To verify declarations are on the PDP and calculate the 40% area rule (Rule 7). | OCR doesn't know which side of a package it's reading. | Bounding Box |
| `grouped_declaration_panel` | Bounding box of the area where mandatory declarations are printed together (usually back/side). | To enforce Rule 9 (declarations must be grouped together). | OCR cannot infer the structural grouping intent of a package layout. | Bounding Box |
| `barcode` | Bounding box of 1D barcodes. | To crop and decode for GTIN lookup. | Barcodes are non-text geometric patterns. | Bounding Box |
| `qr_code` | Bounding box of 2D barcodes/QR codes. | For e-commerce/digital link scanning. | QR codes are non-text geometric patterns. | Bounding Box |

## 4. OCR-First Decision Matrix
For specific legal declarations, we rely on the following pipeline:

| Declaration | Evaluation Strategy |
|-------------|---------------------|
| **MRP** | OCR + Deterministic parser (regex) |
| **Net Quantity** | OCR + Deterministic parser |
| **Manufacturer** | OCR + NER/Address matching |
| **Best Before / Expiry** | OCR + Date parsing |
| **Country of Origin** | OCR + Keyword matching |
| **Font Size (Rule 7/8)** | YOLO (`principal_display_panel`) → calculate area → table lookup for min font size → OpenCV/OCR polygon height → calculate physical size. |
| **Grouping (Rule 9)** | YOLO (`grouped_declaration_panel`) → check if all OCR bounding boxes for mandatory fields intersect this YOLO region. |
| **Legibility** | OpenCV image quality + OCR confidence → `REVIEW` when insufficient. |
| **Maximum Permissible Error (MPE)** | Physical measurement required → Image-only verification impossible. |

## 5. Annotation Types
- **Format:** YOLO normalized detection format (`class x_center y_center width height`).
- **Values:** Normalized from `0.0` to `1.0`.
- **Type:** Bounding boxes are sufficient for the initial detector.

## 6. Image Requirements
We do NOT reject realistic difficult images. Real-world robustness is the primary goal.

- **Formats:** JPG, PNG, WEBP.
- **Resolution:** Minimum 640x640 for YOLO. Ideally higher (e.g., 1920x1080) for reliable OCR.
- **Aspect Ratio:** Images should be padded to square (or handled natively by the model) without extreme stretching.
- **Tolerances:**
  - *Blur/Glare:* Include variations. Severe degradation should be flagged by the pipeline for `REVIEW`.
  - *Perspective:* Include angled shots, curved bottles, and transparent packaging.
  - *Occlusion/Partial Labels:* Include partial views to train the model not to invent missing data.

## 7. Dataset Sources
**DO NOT scrape Google Images, Amazon, Flipkart, Blinkit, or Zepto.**

Acceptable sources:
1. Open Food Facts (Indian product subset).
2. Open/licensed academic datasets.
3. Explicitly licensed commercial datasets.
4. Synthetic images specifically generated for negative/edge cases.

*Requirement:* Every dataset record must include metadata preserving provenance (Source URL, License, Commercial Use Allowed, etc.).

## 8. India-Specific Data Priority
The target system is for Indian packaged commodities governed by the Legal Metrology Act.
- **Primary Priority:** Indian-market packaging (contains specific `fssai`, `MRP Rs.`, and `Packed Date` patterns).
- **Secondary Priority:** International packaging (useful for generalized object detection, bounding box robustness, and barcode localization, but NOT for legal compliance ground truth).

## 9. Negative Examples
Negative examples are crucial for reducing false positives. Do not unnecessarily annotate objects in these images.
- **Include:** Promotional posters, restaurant menus, loose/unpackaged goods (e.g., loose apples), hand-written price tags, and generic e-commerce screenshots.
- **Purpose:** Teaches YOLO that not every piece of paper with a price is a `product_package` or `principal_display_panel`.

## 10. Dataset Split Policy (Train / Val / Test)
- **Do not split randomly.** 
- **Grouping:** Group images by `brand_product_family` to prevent data leakage. For example, if "Acme Chips 50g" is in the training set, "Acme Chips 100g" MUST also be in the training set. Moving it to the test set inflates evaluation metrics because the packaging design is visually identical.

## 11. Dataset Size Targets
Prioritize diversity, annotation quality, and Indian packaging over raw image count.
- **MVP Target:** ~1,000 carefully curated images spanning food, cosmetics, and electronics.
- **Strong SIH Target:** 5,000 - 10,000 highly diverse images.
- **Production Target:** 50,000+ images.

## 12. Quality Control Policy
- Bounding boxes must tightly cover the intended region.
- No invalid coordinates (must be strictly `0.0` to `1.0`).
- No duplicate labels for the same object.
- Unreadable or severely degraded images must be flagged.
- Ambiguous regions must be marked for `REVIEW`.

## 13. Legal Safety Disclaimer
**Dataset annotations represent visual evidence only.**
The dataset is NOT legal ground truth. Legal ground truth is derived strictly from the deterministic application of official Legal Metrology rules against the extracted visual evidence, within the correct applicability context.
