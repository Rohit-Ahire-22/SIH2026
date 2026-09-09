/**
 * evidenceFusionService.js
 * 
 * Responsible for geometrically fusing OCR text bounding boxes with
 * visual/CV bounding boxes (like the Principal Display Panel).
 */

/**
 * Calculates the spatial relationship between an OCR declaration bbox and a visual PDP bbox.
 * Both bboxes are expected to be arrays of points: [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
 * or simply min/max bounds if derived differently.
 * For simplicity we assume axis-aligned bounding boxes (AABB) represented by [xmin, ymin, xmax, ymax].
 */

function getAABB(points) {
  if (!points || !Array.isArray(points) || points.length === 0) return null;
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  return {
    xmin: Math.min(...xs),
    ymin: Math.min(...ys),
    xmax: Math.max(...xs),
    ymax: Math.max(...ys)
  };
}

function computeIntersectionArea(b1, b2) {
  const x_overlap = Math.max(0, Math.min(b1.xmax, b2.xmax) - Math.max(b1.xmin, b2.xmin));
  const y_overlap = Math.max(0, Math.min(b1.ymax, b2.ymax) - Math.max(b1.ymin, b2.ymin));
  return x_overlap * y_overlap;
}

function computeArea(b) {
  return (b.xmax - b.xmin) * (b.ymax - b.ymin);
}

export class EvidenceFusionService {
  /**
   * Fuses extracted OCR fields with visual evidence.
   * @param {Object} extractedFields - Output from ocrFieldExtractionService
   * @param {Object} visualResult - Output from VisualDetectionClient
   * @param {Array} ocrDetections - Raw OCR detections containing bboxes
   * @returns {Object} Fused evidence
   */
  static fuseEvidence(extractedFields, visualResult, ocrDetections) {
    const fused = {
      visualInferenceStatus: visualResult?.inferenceStatus || "UNKNOWN",
      pdpDetected: false,
      pdpConfidence: 0,
      pdpBbox: null,
      fusedFields: {}
    };

    // Safety check for missing visual model
    if (!visualResult || visualResult.inferenceStatus !== "SUCCESS") {
      // If the model is UNAVAILABLE_MODEL_MISSING, just pass the fields through with UNKNOWN relations
      for (const [key, fieldData] of Object.entries(extractedFields)) {
        if (fieldData && fieldData.value !== 'REVIEW') {
          fused.fusedFields[key] = {
            ...fieldData,
            spatialRelationToPdp: "UNKNOWN",
            fusionReason: `Visual inference status: ${visualResult?.inferenceStatus || "UNKNOWN"}`
          };
        }
      }
      return fused;
    }

    // Attempt to find PDP detection
    const detections = visualResult.detections || [];
    const pdpDetection = detections.find(d => d.label === 'pdp' || d.label === 'principal_display_panel');

    if (pdpDetection) {
      fused.pdpDetected = true;
      fused.pdpConfidence = pdpDetection.confidence;
      fused.pdpBbox = pdpDetection.bbox;
    }

    const pdpAABB = getAABB(fused.pdpBbox);

    // Map fields to their corresponding OCR boxes
    // ocrFieldExtractionService typically doesn't pass back the exact bbox in the structured output
    // for all fields perfectly in this iteration. We will look up the text in raw detections to find the bbox.
    // This is a naive association for demonstration; robust systems would track detection IDs.
    
    for (const [key, fieldData] of Object.entries(extractedFields)) {
      if (!fieldData || fieldData.value === 'REVIEW') continue;

      let spatialRelationToPdp = "UNKNOWN";
      let fusionReason = "PDP not detected or field bbox not found";

      if (fused.pdpDetected && pdpAABB) {
        // Find the matching OCR detection by string matching
        // In a real system, `fieldData` should carry `detectionId` or `bbox`
        const textToFind = String(fieldData.value).toLowerCase();
        const match = ocrDetections.find(d => String(d.text).toLowerCase().includes(textToFind));

        if (match && match.bbox) {
          const fieldAABB = getAABB(match.bbox);
          if (fieldAABB) {
            const intersectionArea = computeIntersectionArea(fieldAABB, pdpAABB);
            const fieldArea = computeArea(fieldAABB);
            
            if (fieldArea > 0) {
              const overlapRatio = intersectionArea / fieldArea;
              if (overlapRatio > 0.9) {
                spatialRelationToPdp = "INSIDE";
                fusionReason = "OCR bounding box is fully contained within PDP bounding box";
              } else if (overlapRatio > 0.1) {
                spatialRelationToPdp = "PARTIAL";
                fusionReason = "OCR bounding box partially intersects PDP bounding box";
              } else {
                spatialRelationToPdp = "OUTSIDE";
                fusionReason = "OCR bounding box is outside PDP bounding box";
              }
            }
          }
        } else {
            // Check if fieldData itself has a bbox (if the extractor was updated to pass it)
            if (fieldData.bbox) {
                const fieldAABB = getAABB(fieldData.bbox);
                if (fieldAABB) {
                    const intersectionArea = computeIntersectionArea(fieldAABB, pdpAABB);
                    const fieldArea = computeArea(fieldAABB);
                    if (fieldArea > 0) {
                        const overlapRatio = intersectionArea / fieldArea;
                        if (overlapRatio > 0.9) {
                            spatialRelationToPdp = "INSIDE";
                            fusionReason = "OCR bounding box is fully contained within PDP bounding box";
                        } else if (overlapRatio > 0.1) {
                            spatialRelationToPdp = "PARTIAL";
                            fusionReason = "OCR bounding box partially intersects PDP bounding box";
                        } else {
                            spatialRelationToPdp = "OUTSIDE";
                            fusionReason = "OCR bounding box is outside PDP bounding box";
                        }
                    }
                }
            }
        }
      }

      fused.fusedFields[key] = {
        ...fieldData,
        spatialRelationToPdp,
        fusionReason
      };
    }

    return fused;
  }
}
