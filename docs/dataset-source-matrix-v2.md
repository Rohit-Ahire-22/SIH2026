# SIH26034 Dataset Source Research Report (V2)

## 1. Executive Summary
This report re-evaluates potential computer vision datasets to augment the SIH26034 pipeline, placing strict emphasis on legal provenance, commercial compatibility, and multi-view packaging coverage (specifically back/ingredients panels). We investigated Open Datasets, Indian Retail sources, Commercial E-commerce platforms, and Academic collections. The research reveals that most academic datasets are legally restricted from commercial or derivative use, and Indian commercial retail platforms strictly prohibit automated data extraction. Consequently, Open Food Facts remains the sole legal, multi-view primary dataset.

## 2. Dataset Candidates Evaluated
**Category A (Open Datasets):** Open Food Facts, GroceryStoreDataset, Open Images V7, Grocer-Help
**Category B (Indian Data Sources):** Various Kaggle Indian Grocery Uploads
**Category C (Commercial Retail Platforms):** Swiggy Instamart, Blinkit, Zepto, BigBasket, Amazon India, Flipkart
**Category D (Manufacturer Sources):** Unspecified Brand Press Kits (Generally restricted to editorial use)
**Category E (Community Data):** GitHub/Academic Repos (Products-10K, SKU-110K, RPC)

## 3. Open Food Facts Licensing
Based on current official documentation (https://world.openfoodfacts.org/terms-of-use):
- **Database License:** Open Database License (ODbL 1.0)
- **Database Contents License:** Database Contents License (DbCL 1.0)
- **Image License:** Creative Commons Attribution ShareAlike 3.0 (CC BY-SA 3.0)
- **License URL:** https://creativecommons.org/licenses/by-sa/3.0/deed.en
*Correction:* We previously listed the image license as CC BY-SA 4.0. The official legal page explicitly links to version 3.0. Additionally, Open Food Facts warns that graphical elements within the photos may be subject to third-party copyright, so these images are not entirely free of third-party rights.

## 4. Open Dataset Analysis
- **GroceryStoreDataset (MIT):** Excellent shelf imagery for YOLO bounding-box robustness. Legal to use.
- **Open Images V7 (CC BY 4.0):** Huge dataset with packaged goods detection. Legal to use.
- **Academic Datasets (SKU-110K, RPC, Products-10K):** High resolution but strictly prohibit commercial use. Rejected.

## 5. Indian Dataset Analysis
Indian datasets uploaded to Kaggle by users are universally derived from scraped e-commerce catalogs (BigBasket, Amazon). Because the scrape violates the source Terms of Service, the downstream datasets lack legal validity for a compliance project. They are UNCLEAR and rejected.

## 6. Commercial Platform Analysis (Instamart, Blinkit, Zepto, etc.)
Indian quick-commerce platforms provide incredibly rich, multi-view, high-resolution imagery of Indian packaged commodities. However, their Terms of Service strictly prohibit scraping, reproducing, or extracting data without an enterprise API agreement. The images are owned by the sellers or brands, not the platform. 
**Conclusion:** These are REFERENCE_ONLY. We cannot download or train models on these images without a written legal partnership.

## 7. Manufacturer-Source Analysis
Brand press assets usually restrict usage to journalistic reporting ("editorial use only") and prohibit derivative ML training. Explicitly licensed open datasets from manufacturers are currently non-existent for the Indian market.

## 8. Back-Panel Source Analysis
**Strongest Source:** Open Food Facts.
Academic datasets universally ignore back panels because their research focuses on front-facing shelf recognition. E-commerce platforms possess back panels but restrict access. Open Food Facts is the only legally verifiable source for ingredients, nutrition, and back packaging.

## 9. High-Resolution Source Analysis
**Strongest Source:** Open Images V7 & GroceryStoreDataset (>2MP smartphone shots). While SKU-110K is very high resolution, it is academically restricted. 

## 10. License Matrix & 11. SIH26034 Task Matrix

| Dataset | Indian Rel. | Front | Back | YOLO | OCR | Legal Status | Tier |
|---------|-------------|-------|------|------|-----|--------------|------|
| **Open Food Facts** | HIGH (5/5) | Yes | Yes | 3/5 | 5/5 | CC BY-SA 3.0 | TIER 1 |
| **GroceryStoreDataset**| LOW (1/5) | Yes | No | 5/5 | 1/5 | MIT | TIER 1 |
| **Open Images V7** | MED (3/5) | Yes | Yes | 5/5 | 2/5 | CC BY 4.0 | TIER 1 |
| **Kaggle Indian** | HIGH (5/5) | Yes | No | 2/5 | 1/5 | UNCLEAR | TIER 2 |
| **Zepto/Blinkit** | HIGH (5/5) | Yes | Yes | 5/5 | 5/5 | PROHIBITED | TIER 3 |
| **SKU-110K** | UNK (0/5) | Yes | No | 5/5 | 0/5 | PROHIBITED | REJECTED|

## 12. Tier 1 Sources (Approved for Ingestion)
1. **Open Food Facts** (CC BY-SA 3.0 / ODbL 1.0)
2. **GroceryStoreDataset** (MIT)
3. **Open Images V7** (CC BY 4.0 - Packaged Goods Subset)

## 13. Tier 2 Sources (Need Permission)
1. **Grocer-Help** (Academic, needs author permission)
2. **Kaggle Indian Grocery Datasets** (Requires provenance tracing)

## 14. Tier 3 Sources (Reference Only)
1. **Swiggy Instamart / Blinkit / Zepto / BigBasket / Amazon / Flipkart** (Commercial platforms)
2. **Brand Press Kits**

## 15. Rejected Sources
- **Products-10K, SKU-110K, RPC, MVTec D2S, Freiburg Groceries:** Rejected strictly due to non-commercial licensing restrictions.

## 16. Recommended MVP Combination (1,000 Images)
We recommend a two-source combination targeting 1,000 images:
- **Open Food Facts (85% - 850 images):** The primary source for compliance. Specifically targeting Indian barcodes to retrieve `front` (30%), `back` (25%), `ingredients` (20%), and `nutrition` (10%) panels.
- **GroceryStoreDataset (15% - 150 images):** The secondary source for context. Providing `shelf/context` views to pretrain YOLO to recognize packaging geometries in the wild.

## 17. Acquisition Plan (Do Not Execute Yet)
1. **Phase A:** Clean up existing metadata schema to reflect exact CC BY-SA 3.0 and ODbL separation.
2. **Phase B:** Execute OFF downloader to target 850 images, enforcing criteria for back/nutrition panels.
3. **Phase C:** Ingest 150 images from GroceryStoreDataset GitHub.
4. **Phase D:** Merge datasets into `dataset/raw/`, mapping to the unified JSON schema.
5. **Phase E:** Run cross-dataset duplicate strategy (dHash).
6. **Phase F:** Unified audit generation.
7. **Phase G:** Bounding Box annotation.

## 18. Risks and Limitations
- **Resolution Limit:** Open Food Facts mobile uploads are often heavily compressed or low resolution (<0.3 MP), making OCR extremely difficult on dense ingredients lists.
- **Indian Market Sparsity:** While OFF has Indian products, the community contribution rate for back panels in India is very low compared to Europe. We may struggle to find 850 high-quality Indian back panels.

---

## 21. Final Decision Responses

**A. What should be our PRIMARY dataset?**
Open Food Facts (CC BY-SA 3.0 / ODbL 1.0).

**B. What should provide BACK/DECLARATION imagery?**
Open Food Facts. It is the only legally verifiable dataset providing dedicated back/ingredients imagery.

**C. What should provide SHELF/CONTEXT imagery?**
GroceryStoreDataset (MIT Licensed).

**D. What should provide BARCODE/QR imagery?**
Open Food Facts (often captures barcodes in nutrition shots).

**E. Which commercial websites are REFERENCE ONLY?**
Swiggy Instamart, Blinkit, Zepto, BigBasket, Amazon India, and Flipkart. Scraping them is prohibited.

**F. Which datasets require permission?**
Grocer-Help and user-uploaded Kaggle datasets.

**G. Which datasets are completely rejected?**
SKU-110K, Products-10K, RPC, MVTec D2S, Food-101, COCO-Text, Freiburg Groceries.

**H. What should our first 1,000-image acquisition plan look like?**
- 850 OFF images (Front: 300, Back: 250, Ingredients/Nutrition: 300)
- 150 GroceryStoreDataset images (Shelf/Context: 150)
