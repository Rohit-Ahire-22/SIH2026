# SIH26034 Dataset Research Report: Back-Panel Source Discovery (V1)

## 1. Executive Summary
This research spike investigated open datasets capable of solving the core SIH26034 Legal Metrology requirement: reading legally mandated declarations (MRP, dates, ingredients, manufacturer) from the back panels of Indian packaged commodities. The research found that **there are currently zero open, legally reusable datasets providing high-resolution back-panel images of Indian packaged commodities.** While datasets like FineGrainOCR provide excellent global support data, solving the Indian-specific compliance requirement mandates a small proprietary data collection effort.

## 2. Problem Discovered in Step 21
Step 21 proved that the Open Food Facts (OFF) database for India overwhelmingly consists of low-resolution (<0.3 MP) front-only images. Out of the sample tested, 0% of Indian products had back, ingredients, or nutrition panels available. OCR is impossible on these images.

## 3. Why GroceryStoreDataset is Removed
GroceryStoreDataset provides generic shelf context but no close-up package panels containing readable legal declarations. Since our requirement is Legal Metrology compliance (OCR on labels), generic produce/shelf datasets are irrelevant. It is removed from the core dataset strategy.

## 4. FineGrainOCR Investigation
- **Description:** A dataset of ~91,894 image/text samples for fine-grained grocery product recognition, including challenging side/ingredient panels.
- **Resolution:** 2592x1944 (HIGH).
- **License:** CC0-1.0 (Public Domain).
- **Relevance:** Excellent for training general OCR robustness and panel detection, but it lacks Indian-specific products.
- **Verdict:** APPROVED (as Global Support Data).

## 5. Grocer-Help Investigation
- **Description:** An Indian grocery dataset with 7,371 images collected from Indian stores.
- **Relevance:** Focuses on shelf layout, occlusions, and dense arrangements rather than close-up back panels for OCR.
- **License:** Unclear/Academic (Hosted on Zenodo, typically non-commercial).
- **Verdict:** NEEDS_PERMISSION.

## 6. Kaggle Indian Grocery Investigation
- **Description:** Various user-uploaded datasets containing Indian grocery images.
- **Relevance:** Predominantly front-facing.
- **License:** UNVERIFIED. The vast majority of these images are scraped from BigBasket, Amazon India, or Swiggy Instamart, violating Terms of Service. They cannot be used legally for ML derivative works.
- **Verdict:** REJECTED (Unverified provenance).

## 7. Open Food Facts Global Investigation
- **Description:** The global OFF dataset (especially France/Europe) contains millions of high-resolution back and ingredient panels on AWS.
- **Relevance:** While we can filter the database to find European back panels to train general OCR/CV, they do not contain Indian Legal Metrology declarations (like MRP, FSSAI logos, Indian addresses). 
- **Verdict:** CONDITIONAL (Indian subset only good for Front CV; Global subset good for Support CV).

## 8. Indian Academic/Research Datasets
Academic literature shows active OCR research in India (e.g., license plates, ancient scripts, TV text), but no downloadable image dataset exists for packaged food back panels.
- **Verdict:** REFERENCE / NOT IMAGE DATASET.

## 9. Manufacturer Sources
Manufacturers provide product imagery, but these are almost exclusively stylized front-facing marketing assets (e-commerce renders). Developer APIs (if they exist) restrict usage to partner retail, not open AI training.
- **Verdict:** REFERENCE ONLY.

## 10. Creative Commons Sources
A manual search for "Indian packaged food packaging" yields a negligible amount of verifiable CC-licensed photos, entirely insufficient for ML training.

## 11. Commercial-Source Exclusion
Swiggy Instamart, Blinkit, Zepto, BigBasket, Amazon India, and Flipkart remain strictly **REFERENCE ONLY**. They cannot be scraped.

## 12. License Matrix
*(See JSON report for full details)*
- FineGrainOCR: CC0-1.0
- Open Food Facts: CC BY-SA 3.0 / ODbL
- Grocer-Help: Academic (Needs Permission)
- Kaggle Datasets: Unverified

## 13. Back-Panel Coverage Matrix
- FineGrainOCR: Strong
- Open Food Facts (Global): Strong
- Open Food Facts (India): **0%**
- Grocer-Help: Weak
- Kaggle: Weak

## 14. Resolution Matrix
- FineGrainOCR: HIGH (2592x1944)
- Open Food Facts (AWS Raw): HIGH
- Open Food Facts (API): LOW (<0.3 MP)
- Grocer-Help: Unknown
- Kaggle: Variable

## 15. OCR Suitability Matrix
- FineGrainOCR: EXCELLENT (Provides Google Vision OCR JSON)
- Open Food Facts (Global): GOOD
- Open Food Facts (India): FAILED

## 16. SIH26034 Relevance Scoring
- **FineGrainOCR:** 4/5 (Great for OCR/CV, lacks Indian context).
- **Grocer-Help:** 3/5 (Good Indian context, lacks OCR resolution/back panels).
- **Kaggle:** 1/5 (Illegal).

## 17-20. Status Summaries
- **Approved Sources:** 1 (FineGrainOCR for global support).
- **Conditional Sources:** 1 (Open Food Facts).
- **Permission-Required Sources:** 1 (Grocer-Help).
- **Rejected/Unverified Sources:** 8+ (Kaggle, Commercial Platforms, etc.).

## 21. Proprietary Fallback Analysis
Since no open dataset can provide Indian back panels, we must create a **Small Proprietary Smartphone Dataset**.
- **Scope:** 10 to 50 physical products.
- **Views:** 4 views per product (Front, Back, Ingredients, Nutrition/MRP).
- **Total Images:** 40 to 200 high-resolution images.
- **Effort:** 1-2 hours of manual smartphone photography in a local grocery store or pantry.

## 22. Recommended Dataset Architecture
1. **Core Indian Legal-Label Data:** Proprietary Smartphone Dataset (e.g., 200 images of Indian back panels).
2. **General Packaging CV Data:** FineGrainOCR (to train the model on general text localization and perspective distortion).

## 23. Recommended Next Acquisition Experiment
Conduct a 10-product proprietary smartphone data collection test. The user should photograph 10 household Indian packaged commodities (front, back, side) to validate that smartphone resolution is sufficient for PaddleOCR to extract Legal Metrology fields.

## 24. Risks and Limitations
- Relying on a small proprietary dataset means we will not have the volume typically expected for deep learning, forcing us to rely heavily on zero-shot/few-shot capabilities of foundational models (like PaddleOCR and pre-trained YOLO) rather than training from scratch.

---

## 25. Final Decision Responses

**A. Best legitimate source for Indian BACK images?**
There are none. A proprietary dataset is required.

**B. Best legitimate source for Indian DECLARATION/PANEL images?**
There are none. A proprietary dataset is required.

**C. Best high-resolution OCR dataset?**
FineGrainOCR (CC0-1.0).

**D. Best Indian packaged-product dataset?**
Open Food Facts (for front panels only). Grocer-Help could be used for shelf detection if permission is granted.

**E. Can Open Food Facts realistically solve the Indian back-panel problem?**
**No.** The Indian community has not uploaded back panels.

**F. Can FineGrainOCR be used?**
**Yes.** It is fully CC0 and contains high-resolution back/side panels. However, it lacks Indian specific declarations (like FSSAI logos or MRP formats).

**G. Can Grocer-Help be used?**
**No**, unless academic permission is explicitly verified. It also focuses on shelf arrays, not back-panel OCR.

**H. Can Kaggle Indian Grocery be used?**
**No.** They are unauthorized scrapes of commercial platforms.

**I. Is a proprietary smartphone dataset necessary?**
**YES.** It is the *only* legal way to acquire high-resolution Indian back panels for this project.

**J. What is the smallest additional experiment required before collecting the final dataset?**
A 10-product (40 image) manual smartphone collection experiment to verify OCR viability on real Indian labels.
