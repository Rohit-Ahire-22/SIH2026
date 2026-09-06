# Open Food Facts Usage and Licensing

## 1. Dataset Source
This dataset is derived from the official [Open Food Facts](https://world.openfoodfacts.org/) project. The subset downloaded consists of product images specifically filtered for the Indian market to support the SIH26034 Legal Metrology computer vision pipeline.

## 2. Licensing
There is a critical distinction between the database license and the image license in Open Food Facts:
- **Image License:** Individual photos contributed by users are licensed under the **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)** license.
- **Database License:** The structured metadata and database itself are licensed under the **Open Database License (ODbL 1.0)**.

## 3. Attribution Requirements
We must publicly attribute Open Food Facts in our repository README, our application's "About" page, and any published documentation. 
**Required Attribution Text:**
> "Contains data and images from Open Food Facts contributors, licensed under the Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) license and the Open Database License (ODbL)."

## 4. Share-Alike Implications
Any derivative works (including custom YOLO bounding boxes, polygons, or modified cropped images) created from these images **MUST** be distributed under the same CC BY-SA 4.0 license if they are shared publicly. 

## 5. What We Downloaded
The controlled downloader script (`downloadOpenFoodFacts.js`) specifically targets:
- Indian-market products (`countries_tags=india`).
- Packaging images labeled as `front`, `back`, `ingredients`, or `nutrition`.

## 6. How the Downloaded Data is Stored
- **Images:** Saved in `dataset/raw/open-food-facts/`. Original filenames are preserved but appended with a SHA-256 hash to prevent duplicates (e.g., `[barcode]_[type]_[hash].jpg`). Duplicates are rejected, but the first copy's metadata is preserved.
- **Image Types:** The `imageType` field correctly preserves the view (`front`, `back`, `ingredients`, `nutrition`, `packaging`, or `unknown`). Images are never assumed to be "front" just because they are generic URLs.
- **Metadata:** Stored in `dataset/metadata/open-food-facts-products.jsonl`. This preserves the source URL, `imageLicense`, `dataLicense`, product name, brand, and exact `imageSourceField` for every image.
- **Country Filter Limitations:** The `countryTags` field (e.g., "en:india") indicates the product is sold or registered in India on Open Food Facts. It does not definitively prove it was manufactured in India.
- **Manifests:** Summary statistics of the download run are saved in `dataset/manifests/`.

## 7. Handling Derived Annotations
When we annotate these images for YOLO classes (`product_package`, `principal_display_panel`, etc.), the resulting JSON/TXT annotation files will be placed in `dataset/annotations/`. These annotations inherit the CC BY-SA 4.0 license.

## 8. Redistribution
If we publish our custom YOLO dataset (images + annotations) for SIH or the open-source community, we must include a copy of the CC BY-SA 4.0 license and the required attribution text.

## 9. Official Source Reference
* [Open Food Facts Database](https://world.openfoodfacts.org/)
* [Terms of Use and Licensing](https://world.openfoodfacts.org/terms-of-use)

## 10. Important Limitations
- The images may contain third-party logos or branding. The CC BY-SA license applies to the photography contribution to Open Food Facts, not the underlying trademarks. We do not claim ownership of brand graphics.
- We do not scrape e-commerce sites (like Amazon, Flipkart) because their images are copyrighted and restricted from commercial reuse. Open Food Facts is used exclusively because of its CC BY-SA compliance.
- These images serve as **visual evidence only**. They do not represent definitive legal compliance until processed by the SIH26034 deterministic legal engine.
