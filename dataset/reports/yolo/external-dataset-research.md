# External Dataset Research for YOLO ROI

This report documents the research into external datasets that could potentially alleviate the need for manual bounding box annotation of Indian Legal Metrology packages.

## Candidate Datasets

### 1. Open Food Facts (OFF)
- **Source**: [https://world.openfoodfacts.org/](https://world.openfoodfacts.org/)
- **License**: Open Database License (ODbL) v1.0
- **Commercial Use**: Permitted (requires attribution and share-alike for the database, but individual images may fall under different rules in some jurisdictions).
- **Modification**: Permitted
- **SIH Usage Status**: `conditionally_approved`
- **Reason**: OFF has millions of product images, including Indian products. However, previous step audits confirmed they lack YOLO bounding box annotations for specific legal declaration regions. They have generic image tags (front, nutrition, ingredients). Useful for pre-training a classifier or base detector, but cannot be directly imported as YOLO `declaration_panel` ground truth without human verification.

### 2. GroceryStoreDataset
- **Source**: [https://github.com/marcusklasson/GroceryStoreDataset](https://github.com/marcusklasson/GroceryStoreDataset)
- **License**: MIT License
- **Commercial Use**: Permitted
- **Modification**: Permitted
- **SIH Usage Status**: `rejected`
- **Reason**: As previously established, this dataset features mostly European/Western products taken from natural shelf-views. It does not provide the high-resolution close-ups of back panels required for Indian Legal Metrology parsing.

### 3. FineGrainOCR
- **Source**: Various academic releases (e.g., related to ICDAR or robust reading competitions)
- **License**: Non-commercial / Research-only (Typical for many academic OCR datasets)
- **Commercial Use**: NOT permitted without explicit licensing.
- **Modification**: Permitted (for research)
- **SIH Usage Status**: `research_only`
- **Reason**: Datasets containing fine-grained text localization are powerful, but their "research-only" restriction makes them inappropriate for a commercial-grade government compliance tool unless explicitly cleared.

### 4. Commercial E-Commerce Websites (Amazon, Flipkart, Blinkit)
- **Source**: Proprietary web portals
- **License**: Proprietary / Copyrighted
- **Commercial Use**: Prohibited (Scraping violates terms of service and copyright)
- **SIH Usage Status**: `rejected`
- **Reason**: We absolutely cannot scrape these platforms for imagery. The system must rely on user-captured datasets or legally approved open datasets.

## Conclusion & Actionable Next Steps
Currently, no open dataset exists that contains bounding boxes perfectly mapped to our custom `product_package`, `principal_display_panel`, and `declaration_panel` classes for Indian commodities. Open Food Facts is a strong candidate for providing raw images, but it does **not** solve the YOLO annotation bottleneck. 

We must rely on **Weak Supervision** (Candidate Generation) overlaid on user-captured images, followed by minimal human verification.
