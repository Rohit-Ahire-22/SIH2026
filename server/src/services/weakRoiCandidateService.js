/**
 * Weak ROI Candidate Service
 * Generates heuristic-based bounding boxes to bootstrap YOLO annotation
 * without manually labeling thousands of images.
 * 
 * IMPORTANT: Outputs of this service MUST retain "weak_candidate" provenance.
 */

const LEGAL_KEYWORDS = [
  'MRP', 'MAXIMUM RETAIL PRICE',
  'NET QTY', 'NET QUANTITY', 'NET WT',
  'BATCH', 'LOT',
  'MFD', 'MFG', 'MANUFACTURED',
  'PACKED', 'PKD',
  'EXP', 'EXPIRY', 'USE BY', 'BEST BEFORE',
  'MANUFACTURER', 'PACKER', 'IMPORTER',
  'CUSTOMER CARE', 'CONSUMER CARE',
  'COUNTRY OF ORIGIN'
];

/**
 * Checks if a string contains any legal metrology keywords.
 */
function hasLegalKeyword(text) {
  if (!text) return false;
  const upper = text.toUpperCase();
  return LEGAL_KEYWORDS.some(kw => upper.includes(kw));
}

/**
 * Normalizes coordinates to YOLO format (center_x, center_y, width, height) [0.0 - 1.0]
 */
function toYoloNormalized(minX, minY, maxX, maxY, imgW, imgH) {
  // Constrain to image boundaries
  const x1 = Math.max(0, Math.min(minX, imgW));
  const y1 = Math.max(0, Math.min(minY, imgH));
  const x2 = Math.max(0, Math.min(maxX, imgW));
  const y2 = Math.max(0, Math.min(maxY, imgH));

  const w = (x2 - x1) / imgW;
  const h = (y2 - y1) / imgH;
  
  if (w <= 0 || h <= 0) return null;

  const cx = (x1 + (x2 - x1) / 2) / imgW;
  const cy = (y1 + (y2 - y1) / 2) / imgH;

  return [cx, cy, w, h];
}

/**
 * Generates ROI candidates based on OCR text clusters.
 * 
 * @param {Array} ocrResults - Array of OCR detections: { text, confidence, bbox: [[x1,y1], [x2,y1], [x2,y2], [x1,y2]] }
 * @param {Object} imageMetadata - { width, height }
 * @returns {Object} Candidate generation result
 */
export function generateDeclarationCandidates(ocrResults, imageMetadata) {
  if (!ocrResults || ocrResults.length === 0 || !imageMetadata) {
    return { status: 'no_candidate', provenance: 'weak_candidate', candidates: [] };
  }

  const { width, height } = imageMetadata;
  const keywordHits = [];

  // 1. Identify OCR boxes with keywords
  ocrResults.forEach((res, index) => {
    if (hasLegalKeyword(res.text)) {
      keywordHits.push({ index, result: res });
    }
  });

  if (keywordHits.length === 0) {
    return { status: 'no_candidate', provenance: 'weak_candidate', candidates: [] };
  }

  // 2. Spatial Clustering: For this foundational prototype, we will create a single 
  // bounding box enveloping all legal keyword hits plus a heuristic padding. 
  // (In production, DBSCAN or k-means on coordinates would separate distinct panels).
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let accumulatedConfidence = 0;
  const sourceOcrDetectionIds = [];

  keywordHits.forEach(hit => {
    const box = hit.result.bbox; // format: [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
    
    // Extract min/max from the 4 polygon points
    box.forEach(pt => {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    });

    accumulatedConfidence += hit.result.confidence || 0.8;
    sourceOcrDetectionIds.push(hit.index);
  });

  // 3. Add heuristic padding (e.g., 5% of image width/height) 
  // to capture nearby values (like the actual price next to the "MRP" label)
  const paddingX = width * 0.05;
  const paddingY = height * 0.05;
  
  minX -= paddingX;
  minY -= paddingY;
  maxX += paddingX;
  maxY += paddingY;

  const yoloBox = toYoloNormalized(minX, minY, maxX, maxY, width, height);

  if (!yoloBox) {
    return { status: 'no_candidate', provenance: 'weak_candidate', candidates: [] };
  }

  const avgConfidence = accumulatedConfidence / keywordHits.length;

  return {
    status: 'candidate_generated',
    provenance: 'weak_candidate',
    candidates: [
      {
        className: 'declaration_panel',
        classId: 2, // Maps to our yolo_classes.json
        bbox: yoloBox,
        confidence: avgConfidence,
        sourceOcrDetectionIds
      }
    ]
  };
}
