# Frontend OCR Visualization Guide

This document explains the architecture of the Frontend Hybrid OCR Inspection interface introduced in Step 30.

## Overview
The OCR Inspection Page provides administrators with a visual debugger to understand exactly what the backend AI/OCR engine is seeing, how it maps fields, and how the deterministic legal engine makes decisions.

- **Route:** `/products/:id/ocr`
- **Component Entry:** `client/src/pages/OcrInspectionPage.jsx`
- **Backend API:** `POST /api/products/:id/ocr/hybrid`

## 1. Visualizing OCR Data

### The Coordinate System Problem
The backend returns bounding boxes relative to the original high-resolution product image, formatted as an array of 4 points: `[[x1, y1], [x2, y1], [x2, y2], [x1, y2]]`.

However, the React frontend must display this image responsively (e.g. shrinking a 4000px image to fit a 600px container). If bounding boxes are drawn using absolute CSS pixels, they will immediately misalign when the image scales.

### The SVG ViewBox Solution
The `OcrImageViewer` component solves this using an `<svg>` overlay perfectly mapped to the natural image dimensions:

```jsx
<svg 
  className="absolute top-0 left-0 w-full h-full pointer-events-none"
  viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
  preserveAspectRatio="xMidYMid meet"
>
```

By setting the SVG `viewBox` equal to the image's intrinsic `width` and `height`, we can draw `<rect>` elements using the exact raw coordinates from the backend. The browser automatically scales the SVG (and the rectangles inside it) precisely in tandem with the responsive `<img>`.

## 2. Differentiating Detections

The backend provides a `source` tag for OCR texts and returns `roiEvidence` for the geometry clusters. The frontend translates this into distinct visual languages:

- **Weak ROI Candidates (Inferred Regions)**: 
  - Visual: Dashed thick orange borders (`#ea580c`) with light orange fill.
  - Meaning: This is an area the heuristic engine suspects contains legal data. It was cropped and sent for a high-res OCR pass.
  
- **ROI Detections (High-Res Crop OCR)**:
  - Visual: Solid sky-blue borders (`#0284c7`) with a blue tint on hover/select.
  - Meaning: Text recovered from the high-resolution cropped pass.
  
- **Full-Image Detections (Low-Res OCR)**:
  - Visual: Solid green borders (`#16a34a`) with a green tint on hover/select.
  - Meaning: Text recovered from the initial full-image scan.

## 3. Component Interaction State

A unified React state (`selectedDetectionId`) controls the synchronization between the image overlay and the sidebar list:

- Hovering or clicking an item in the `OcrDetectionList` sets `selectedDetectionId`.
- The `OcrImageViewer` receives this prop and conditionally applies a heavy `strokeWidth` and `fillOpacity` to the corresponding SVG `<rect>`.
- The inverse interaction (clicking a box on the image) similarly highlights the sidebar list item.

## 4. Legal Compliance Separation

**CRITICAL RULE:** The React frontend MUST NOT calculate legal compliance. 

The `ComplianceSummary` component blindly renders the `categoryData` returned from the API payload. If the backend says `REVIEW`, the frontend displays a yellow warning. If the backend score is `92%`, it renders a green progress bar. 

This strict separation ensures the legal metrology engine acts as the single source of truth.

## 5. Error & Fallback Handling

The `runHybridOcr` API handles network errors gracefully:
- **No Image:** The "Run Hybrid OCR" button is disabled if `!product.image.url`.
- **API Failure:** Catches the HTTP error and renders a red `AlertCircle` banner without destroying the currently loaded product context.
- **Missing Fields:** The `ExtractedFieldsPanel` explicitly renders *"Not detected"* in grey italics rather than leaving blanks, preventing ambiguity between a failed detection and a UI rendering error.
