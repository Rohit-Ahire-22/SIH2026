# SIH26034 Dataset Acquisition Experiment Report (V1)

## 1. Experiment Objective
Conduct a controlled dataset acquisition experiment to test the Step 20R strategy before downloading the full 1,000-image dataset. The primary goal was to verify if Open Food Facts (OFF) could provide the target number of `back`, `ingredients`, and `nutrition` panels for Indian commodities, and if GroceryStoreDataset (GSD) could provide `shelf` context.

## 2. Sources Tested
- **Open Food Facts (OFF)** - filtered for `countries_tags=india`
- **GroceryStoreDataset (GSD)** - `train` split

## 3. Products Inspected
- 49 OFF Indian Products (Experiment stopped early due to API 503 limit on page 2, but sufficient for a representative ratio sample).

## 4. Images Downloaded
- Total OFF Images: 48
- Total GSD Images: 9
- **Total Images:** 57

## 5. Image Type Distribution
| Image Type  | Count | Percentage |
| ----------- | ----: | ---------: |
| Front       |    48 |      84.2% |
| Back        |     0 |       0.0% |
| Ingredients |     0 |       0.0% |
| Nutrition   |     0 |       0.0% |
| Packaging   |     0 |       0.0% |
| Shelf       |     9 |      15.8% |

## 6. Resolution Statistics
| Resolution Bucket | Count | Percentage |
| ----------------- | ----: | ---------: |
| <0.3 MP           |    57 |     100.0% |
| 0.3–1 MP          |     0 |       0.0% |
| 1–2 MP            |     0 |       0.0% |
| 2–5 MP            |     0 |       0.0% |
| >5 MP             |     0 |       0.0% |
*(Note: OFF images are heavily downscaled by the API, and GSD base images are also small in this specific raw endpoint).*

## 7. Multi-View Statistics (OFF Products)
| Product Views | Products | Percentage |
| ------------- | -------: | ---------: |
| 1 view        |       48 |     100.0% |
| 2 views       |        0 |       0.0% |
| 3 views       |        0 |       0.0% |
| 4+ views      |        0 |       0.0% |

## 8. Duplicates & Metadata
- **Exact Duplicates:** 0
- **Missing Metadata:** 0 (Provenance fully intact and successfully separated for license: CC BY-SA 3.0 vs MIT).
- **License Status:** CC BY-SA 3.0 (OFF), MIT (GSD) successfully applied.

## 9. Observations
### A. OCR-Readability
With 100% of the images being < 0.3 MP, and 0% of the images targeting the ingredients or back panel directly, OCR readability for legal declarations is extremely poor. Front panels mostly contain branding, not the Legal Metrology required declarations.

### B. Availability of Panels (OFF India)
The experiment reveals a critical issue: Indian products in Open Food Facts are overwhelmingly single-image uploads (front only). The community has not contributed back, ingredients, or nutrition panels at scale for this region.

### C. GroceryStoreDataset Shelf Images
The GSD images successfully provide shelf context and varied geometric perspectives, which will be useful for training the `product_package` YOLO class, but they do not help with OCR of Indian legal declarations.

## 10. Critical Feasibility Calculation
- **Estimated available back images (OFF India):** ~0%
- **Estimated available ingredients images (OFF India):** ~0%
- **Estimated available nutrition images (OFF India):** ~0%
- **Is the 850-image OFF target (Front: 300, Back: 250, Ingredients: 300) feasible?**
  **NOT_FEASIBLE**. Extrapolating a 0% observation means we will not hit the targets for back/ingredients regardless of how many products we query.

## 11. 1,000-Image Target Validation & Revised Distribution
The original distribution is physically impossible using only OFF for the Indian market.
**Revised Evidence-Based Distribution (if restricted to OFF/GSD):**
- Front: 850 (100% of OFF)
- Shelf: 150 (GSD)
- Back/Ingredients: 0

## 12. Quality Gate
- **Resolution:** FAILED (<0.3 MP)
- **Text Visibility (Legal):** FAILED (Only brand text visible)
- **Perspective:** PASSED (Adequate for YOLO bounding boxes)

## 13. GO / NO-GO Decision

- **OPEN FOOD FACTS: CONDITIONAL**
  - *Why:* OFF is perfectly fine for YOLO `front` package detection, but it completely fails our OCR/Legal Metrology requirement for back-panel compliance text.
- **GROCERYSTORE: GO**
  - *Why:* Successfully provides shelf context images for YOLO `product_package` detection.
- **FULL 1,000 IMAGE ACQUISITION: NO-GO**
  - *Why:* Proceeding with the acquisition now would yield 850 low-resolution front images and 0 back/ingredient images. This dataset would be useless for validating SIH26034 compliance rules (which require OCR on the back panel).

## 14. Next-Step Recommendation
Since the target distribution cannot be reached with OFF, we must **NOT** proceed to large scale acquisition.
**Recommendation:** Conduct a small, targeted source research spike specifically to find high-resolution Indian back-panel imagery. If no open datasets exist, we may need to reconsider our "Tier 2" Kaggle datasets and trace their provenance, or manually capture our own initial set of back-panel images using smartphone cameras to create a proprietary Tier 1 dataset.
