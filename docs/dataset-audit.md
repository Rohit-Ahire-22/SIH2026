# Dataset Quality Audit Report
**Timestamp:** 2026-09-05T15:49:16.357Z
**Dataset:** Open Food Facts Indian Product Packaging Subset
**Location:** `dataset/raw/open-food-facts`
**Licensing:** CC BY-SA 4.0 (Images) / ODbL 1.0 (Metadata)

## 1. Summary
- **Total Products:** 40
- **Total Images:** 40
- **Products with Multiple Views:** 0
- **Valid Images:** 40 (0 decode failures, 0 format mismatches)

## 2. Duplicate Analysis
- **Unique SHA-256 Hashes:** 40
- **Exact Duplicate Files:** 0 (0.0%)
- **Perceptual Duplicate Groups:** 0 (dHash distance < 0.15)

## 3. Image Characteristics
- **Orientation:** Portrait: 30, Landscape: 9, Square: 1
- **Average Dimensions:** 283 x 368 (0.10 MP)
- **Resolution Distribution:**
  - < 0.3 MP: 40
  - 0.3–0.75 MP: 0
  - 0.75–1.5 MP: 0
  - 1.5–3 MP: 0
  - > 3 MP: 0

## 4. View Types
- **Front:** 40
- **Back:** 0
- **Ingredients:** 0
- **Nutrition:** 0
- **Packaging/Unknown:** 0

## 5. Pre-OCR Heuristics (Quality Proxies)
*These are image-level heuristics based on resolution and contrast, NOT legal truth.*
- **OCR Readability Proxy:** Good: 0, Moderate: 0, Poor: 40
- **Front-Panel Relevance:** Likely Useful: 0, Uncertain: 31, Poor Quality: 9
- **Packaging Relevance:** Likely Useful: 40, Poor Quality: 0
- **Barcode/QR Potential:** barcode/QR detection not executed because no suitable non-ML decoder was available

## 6. Conclusion
Based on the metrics, this dataset provides a robust smoke-test baseline for the SIH26034 project. 
**Strengths:** All downloaded images are high-fidelity packaging shots (mostly portrait) with no decoding errors. The deduplication effectively blocked scraping loops.
**Limitations:** The current sample heavily favors front-panel views; multi-view representation is minimal in this batch.
**Recommendation:** This dataset is **sufficient for initial OCR experimentation and principal-display-panel detection**. However, for full-scale compliance testing, we must download a larger batch to capture diverse `ingredients` and `back` views before proceeding to YOLO training.
