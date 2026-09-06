# SIH26034 Dataset Source Matrix

This matrix documents the candidate datasets evaluated for supplementing the Open Food Facts baseline. All datasets were evaluated strictly on their actual verifiable licenses, not arbitrary "open source" claims.

| Dataset | Source | Country/Market | Images | Resolution | Front | Back | Ingredients | Nutrition | Packaging | Shelf | Barcode/QR | Annotations | License | Commercial Use | Derivative Use | Redistribution | Training Use | Indian Relevance | SIH Role | Status | Reason |
|---------|--------|----------------|--------|------------|-------|------|-------------|-----------|-----------|-------|------------|-------------|---------|----------------|----------------|----------------|--------------|------------------|----------|--------|--------|
| **Open Food Facts** | Official website | Global (includes India) | > 3 Million | Various | Yes | Yes | Yes | Yes | Yes | No | Yes | Text, OCR, Metadata | CC BY-SA 3.0 (Images), ODbL 1.0 (Database) | Yes | Yes | Yes | Yes | HIGH | PRIMARY_DATASET + MULTI_VIEW_SUPPORT | VERIFIED | Official open database, fully compatible with project goals. |
| **GroceryStoreDataset** | GitHub (marcusklasson) | Sweden | 5,125 | High | Yes | No | No | No | Yes | Yes | No | Class labels | MIT License | Yes | Yes | Yes | Yes | LOW | SECONDARY_DATASET + SHELF_CONTEXT | VERIFIED | Highly permissive MIT license makes it safe for supplementation and context pretraining. |
| **Open Images V7** | Google (storage.googleapis.com) | Global | ~50k (Packaged Goods) | Varied | Yes | Yes | No | No | Yes | Yes | No | Bboxes, Segments | CC BY 4.0 | Yes | Yes | Yes | Yes | MEDIUM | DETECTION_PRETRAINING | VERIFIED | Compatible CC BY 4.0 license, excellent for generalizing package detection models. |
| **Grocer-Help** | Academic Paper | Unknown | Unknown | Unknown | Yes | No | No | No | Yes | Yes | No | Bboxes | Unknown (Academic) | No | No | No | No | UNKNOWN | REJECTED | UNCLEAR | DO NOT USE UNTIL LICENSE IS CLARIFIED |
| **Products-10K** | JD.com / CVPR | China | 10,000 | High | Yes | Yes | No | No | Yes | No | No | Bboxes, Labels | Non-commercial | No | Yes | No | Yes | LOW | DETECTION_PRETRAINING | REJECTED | License explicitly prohibits commercial use. |
| **SKU-110K** | CVPR 2019 / GitHub | Global | 11,762 | High | Yes | No | No | No | Yes | Yes | No | 1.7M Bboxes | Academic / Non-commercial | No | No | No | Yes | UNKNOWN | SHELF_CONTEXT | REJECTED | License strictly prohibits commercial use. |
| **Retail Product Checkout (RPC)** | Megvii (Kaggle/Academic) | China | 83k | High | Yes | Yes | No | No | Yes | No | No | Bboxes | Non-commercial | No | No | No | No | LOW | REJECTED | REJECTED | Academic license prohibits commercial deployment. |
| **MVTec D2S** | MVTec Software GmbH | Global | 21,000 | High | Yes | Yes | No | No | Yes | No | No | Segmentation | CC BY-NC-SA 4.0 | No | Yes | Yes | Yes | LOW | REJECTED | REJECTED | Non-commercial clause (NC) conflicts with potential end-user deployment. |
| **Freiburg Groceries** | Univ. of Freiburg | Germany | 4,947 | Medium | Yes | No | No | No | Yes | No | No | Class labels | Academic | No | No | No | No | LOW | REJECTED | REJECTED | Academic license restricts commercial reuse. |
| **COCO-Text** | COCO Consortium | Global | 63,686 | Varied | No | No | No | No | No | No | No | Text polygons | Mixed (Flickr/CC) | No | No | No | No | LOW | OCR_SUPPORT | REJECTED | License fragmented; not specific to packaging. |
| **Indian Grocery (Kaggle)** | Kaggle (User Uploads) | India | Varies | Varied | Yes | No | No | No | Yes | No | No | Classes | Unclear | No | No | No | No | HIGH | REJECTED | UNCLEAR | DO NOT USE UNTIL LICENSE IS CLARIFIED (Likely scraped from e-commerce). |
| **Food-101** | ETH Zurich | Global | 101,000 | High | No | No | No | No | No | No | No | Classes | Non-commercial | No | No | No | No | LOW | REJECTED | REJECTED | Contains meals, not packaged commodities. |

## Licensing Categories
* **CATEGORY A (Clear for Use):** Open Food Facts, GroceryStoreDataset, Open Images V7
* **CATEGORY B (Needs Clarification):** Grocer-Help, Kaggle Indian Grocery Datasets
* **CATEGORY C (Do Not Use):** Products-10K, SKU-110K, RPC, MVTec D2S, Freiburg Groceries, COCO-Text, Food-101
