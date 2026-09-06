# YOLO Annotation Guide for SIH26034

This guide is designed for human annotators validating or creating bounding boxes for the Legal Metrology packaging dataset.

## Tooling Recommendation
For local Windows annotation without cloud reliance, **LabelImg** or **CVAT** (local Docker container) are recommended. 
1. Install LabelImg via Python: `pip install labelImg`
2. Open LabelImg and select the YOLO format.
3. Open the `dataset/annotations/yolo/images` folder.
4. Load the `classes.txt` file (matching the classes described below).

## Classes

| ID | Class Name | Description |
|---|---|---|
| `0` | `product_package` | The entire physical commodity/packaging as visible in the image. |
| `1` | `principal_display_panel` | The main visual region of the front packaging that identifies the product and brand. |
| `2` | `declaration_panel` | A region (usually on the back) that groups legal declarations (MRP, expiry date, manufacturer, weight). |

## Annotation Rules

### 1. FRONT IMAGES
* Draw a `product_package` bounding box tight around the visible physical package.
* Draw a `principal_display_panel` bounding box tight around the primary brand display surface. 
* **Do NOT** draw a `declaration_panel` unless a cluster of legal declarations is explicitly visible on the front.

### 2. BACK IMAGES
* Draw a `product_package` bounding box.
* Draw a `declaration_panel` bounding box around the contiguous region containing the dense Legal Metrology text (MRP, dates, manufacturing info). 
* **Do NOT** draw a `principal_display_panel` unless the front face is visible due to a specific angle or transparent packaging.
* **Do NOT** draw individual boxes for each individual field (e.g. no separate box for MRP, no separate box for Date). Group them under the single `declaration_panel` region.

### 3. GLARING, PERSPECTIVE, PARTIAL VIEWS
* If a region is partially cut off, box what is visible.
* If a region is completely unreadable due to glare, still box it if you are confident it *is* the declaration panel. The purpose of this model is region-of-interest detection, not OCR extraction.
* Do not box random shelves, backgrounds, or tables.

## What NOT to do
* **NEVER invent a box.** If you cannot identify the declaration panel, leave it blank.
* **NEVER use OCR lines as YOLO ground truth.**
* **NEVER box individual letters.**

## Dataset Versioning
This dataset structure dynamically generates a manifest. If you make modifications, you must run the validation script `npm run validate-annotations` to ensure coordinate integrity and no dataset leakage.
