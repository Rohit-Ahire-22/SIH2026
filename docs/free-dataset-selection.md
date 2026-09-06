# Free Dataset Selection

## 1. Project Requirements

To build the computer vision component of the SIH26034 Legal Metrology system, we require a dataset to train a YOLO object detection model on the following five approved classes:

1. `product_package`: Identifies the physical boundaries of a packaged commodity, distinguishing it from loose items or posters.
2. `principal_display_panel`: Identifies the front/main label (crucial for area calculations).
3. `grouped_declaration_panel`: Identifies regions where mandatory legal declarations are grouped.
4. `barcode`: Localizes 1D barcodes for GTIN lookup.
5. `qr_code`: Localizes 2D codes.

We strictly avoid training YOLO to read text (like MRP or Date) as this is handled by OCR.

## 2. Dataset Evaluation Criteria

Before selecting any dataset, we evaluate it against the following strict criteria:
* **Licensing**: Is the license clearly stated?
* **Attribution**: Does it require attribution? (Acceptable)
* **Redistribution & Modification**: Does it allow creating and sharing derivative works (like custom YOLO bounding box annotations)? This is critical. "No Derivatives" (ND) licenses are instantly rejected.
* **Commercial/Hackathon Suitability**: Is it safe for a student hackathon (Non-Commercial is okay for the event, but limits future startup potential).
* **Indian-Market Relevance**: Does it contain Indian product packaging?
* **Image Quality & Annotations**: Are the images high enough resolution for OCR and do they contain useful existing bounding boxes?
* **Duplicate Risk**: Are there duplicate images that could leak across train/test splits?

## 3. Dataset Comparison

| Dataset | Source | License | Download Size | Images | Indian Relevance | Existing Annotations | Useful Classes | Status |
| ------- | ------ | ------- | ------------: | -----: | ---------------- | -------------------- | -------------- | ------ |
| **Open Food Facts** | Official AWS Open Data | Images: CC BY-SA 4.0<br>DB: ODbL | ~300 GB (Full) | 3M+ | High (India subset) | None (needs custom YOLO) | All 5 classes | **CONDITIONAL** |
| **Grocer-Help** | Zenodo | Unclear / Not fully public | N/A | Unknown | Unknown | Unknown | Unknown | **REJECTED** |
| **Products-6K** | Zenodo | CC BY-NC-ND 4.0 | ~2 GB | ~6,000 | Low | Bounding boxes | `product_package` | **REJECTED** |
| **SKU-110K** | GitHub / Research | Academic/Non-Commercial | 11.6 GB | 11,762 | Low | Dense bounding boxes | `product_package` | **CONDITIONAL** |

## 4. Open Food Facts Analysis

* **Image License**: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).
* **Database/Data License**: Open Database License (ODbL).
* **Attribution**: Required. We must attribute Open Food Facts contributors.
* **Share-Alike Implications**: If we download these images and draw custom YOLO bounding boxes (`principal_display_panel`, etc.), our new annotation dataset MUST be released under the exact same CC BY-SA 4.0 license.
* **Modification/Annotation Implications**: Allowed, provided the derivative work is shared under CC BY-SA 4.0.
* **Suitability for our project**: Excellent. It is safe for SIH, allows modification, and allows commercial use if the dataset remains open.
* **Relevant Image Types**: It explicitly contains front, back, and nutrition images of products, making it perfect for `principal_display_panel` and `grouped_declaration_panel`.
* **Full download necessary?**: No. We should query the Open Food Facts API for the `countries_tags=india` subset to download a small, highly relevant slice.

## 5. Grocer-Help Analysis

* **Exact License/Rights Found**: The dataset is part of ongoing academic research and is not fully public or clearly licensed on Zenodo for unrestricted derivative works.
* **Limitations**: Because the license is unclear and the dataset is not fully published for community modification, it presents a legal risk.
* **Approval Status**: **REJECTED**.

## 6. Products-6K Analysis

* **Exact License/Rights Found**: CC BY-NC-ND 4.0 (Attribution-NonCommercial-NoDerivatives).
* **Annotations**: Provides bounding boxes for products in retail environments.
* **Limitations**: The **NoDerivatives (ND)** clause is fatal to our project. It legally prohibits us from modifying the annotations (e.g., adding `principal_display_panel` boxes) and distributing that new dataset. 
* **Approval Status**: **REJECTED**.

## 7. Additional Free Datasets

**SKU-110K Dataset**
* **Purpose**: Dense object detection in supermarkets.
* **License**: Academic/Non-Commercial use only.
* **Relevance**: Highly useful for training the base `product_package` detector.
* **Limitations**: Non-commercial restriction means we can use it for the SIH hackathon, but cannot use the weights if the project transitions into a commercial startup.

## 8. Recommended Dataset Combination

* **Primary Dataset**: **Open Food Facts (India Subset)**.
* **Supplement Dataset**: None initially. We will rely purely on Open Food Facts to avoid licensing pollution.
* **Avoid**: Products-6K (due to ND restriction) and Grocer-Help (unclear license).
* **Initial Download Target**: ~1,500 images of Indian packaged commodities via the Open Food Facts API. 
* **Required Annotation Effort**: We will need to manually annotate these 1,500 images for all 5 of our specific YOLO classes, as Open Food Facts does not provide bounding box coordinates natively.

## 9. Legal/License Checklist

Before downloading or importing any dataset into the SIH project repository, complete this checklist:
- [ ] Is the exact license explicitly stated in a `LICENSE` file or official metadata?
- [ ] Does the license permit **Modification/Derivatives** (No `ND` clauses)?
- [ ] If the license is Share-Alike (`SA`), are we prepared to open-source our YOLO annotations?
- [ ] If the license is Non-Commercial (`NC`), does our team understand this restricts post-hackathon monetization?
- [ ] Can we legally attribute the original authors in our project README?
- [ ] Are we strictly avoiding scraping copyrighted e-commerce sites (Amazon, Flipkart)?

## 10. Final Recommendation

**Use Open Food Facts as the sole initial dataset.** 

By filtering the Open Food Facts database for Indian products, downloading ~1,500 images, and manually annotating our 5 custom classes, we guarantee 100% legal compliance, high relevance to the Legal Metrology Act, and complete freedom to open-source our resulting model under the CC BY-SA 4.0 license.
