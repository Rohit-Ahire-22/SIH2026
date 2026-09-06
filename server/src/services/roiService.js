/**
 * ROI (Region of Interest) Service Contract
 * Provides the architectural interface for YOLO detection routing.
 * When YOLO is not available (like right now), safely falls back to full-image processing.
 */

/**
 * Simulates a request to the AI Service for YOLO Region Detection
 * @param {Buffer} imageBuffer 
 * @param {string} mimeType 
 * @returns {Promise<Object>} Detection results
 */
export async function detectRegions(imageBuffer, mimeType) {
  // Currently, the AI service YOLO endpoint is not exposed or trained.
  // This returns a safe 'model_unavailable' state mimicking what the Python side would return.
  return {
    success: false,
    status: 'model_unavailable',
    modelVersion: null,
    detections: []
  };
}

/**
 * Selects which regions should be passed to the OCR service based on view and detections.
 * @param {Array} detections The bounding boxes returned from YOLO
 * @param {string} view 'front' or 'back'
 * @returns {Array} Selected regions to crop and OCR
 */
export function selectOcrRegions(detections, view) {
  if (!detections || detections.length === 0) {
    return []; // No regions, implies full-image fallback is needed
  }
  
  if (view === 'front') {
    // Front needs category/identity parsing. Usually the principal_display_panel
    return detections.filter(d => d.className === 'principal_display_panel');
  } else {
    // Back needs legal metrology parsing.
    return detections.filter(d => d.className === 'declaration_panel');
  }
}

/**
 * Processes an image using the ROI architecture, gracefully falling back to full-image OCR.
 * This is a structural blueprint for how future image routes will operate.
 * 
 * @param {Buffer} imageBuffer 
 * @param {string} mimeType 
 * @param {string} view 
 * @param {Function} fallbackOcrFn The existing full-image OCR runner (e.g. runOcrOnImageBuffer)
 */
export async function processImageWithRoiFallback(imageBuffer, mimeType, view, fallbackOcrFn) {
  const yoloResult = await detectRegions(imageBuffer, mimeType);
  
  if (!yoloResult.success || yoloResult.status === 'model_unavailable') {
    // Graceful fallback to original full-image OCR since YOLO is not trained yet.
    return await fallbackOcrFn(imageBuffer, mimeType, 'original');
  }

  const selectedRegions = selectOcrRegions(yoloResult.detections, view);
  
  if (selectedRegions.length === 0) {
    // YOLO ran, but found no relevant regions for this view. Fallback to full OCR.
    return await fallbackOcrFn(imageBuffer, mimeType, 'original');
  }

  // Future implementation:
  // 1. Crop imageBuffer for each selectedRegion
  // 2. Run OCR on each crop
  // 3. Aggregate results
  // For now, if we somehow had fake detections, we'd throw an error or return empty, 
  // but since we guarantee 'model_unavailable', this block isn't reached yet.
  
  throw new Error("ROI cropping and OCR aggregation not yet implemented.");
}
