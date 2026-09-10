/**
 * evidenceFusionService.js
 * 
 * Responsible for geometrically fusing OCR text bounding boxes with
 * visual/CV bounding boxes (like the Principal Display Panel).
 *
 * V2 changes:
 *  - Extracted declarations now carry `bbox` (primary spatial source), so
 *    string-matching against raw OCR detections is used only as a fallback.
 *  - Provenance (sourceType / confidence / signals / status) is preserved
 *    through fusion.
 *  - Fusion output keeps REVIEW-safe behaviour: fields with value null/REVIEW
 *    are passed through with UNKNOWN spatial relation, never dropped.
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

function assertQuadBbox(bbox) {
  return Array.isArray(bbox) &&
    bbox.length === 4 &&
    bbox.every(p => Array.isArray(p) && p.length === 2)
}

export class EvidenceFusionService {
  /**
   * Fuses extracted fields with visual evidence.
   * @param {Object} extractedFields - Output from ocrFieldExtractionService (rich objects with bbox/sourceType)
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
      for (const [key, fieldData] of Object.entries(extractedFields || {})) {
        if (fieldData && fieldData.value !== 'REVIEW' && fieldData.value !== undefined && fieldData.value !== null) {
          fused.fusedFields[key] = {
            ...fieldData,
            spatialRelationToPdp: "UNKNOWN",
            fusionReason: `Visual inference status: ${visualResult?.inferenceStatus || "UNKNOWN"}`
          };
        }
      }
      // REVIEW (null-value) declarations are carried through even without a
      // visual model — they must never be silently dropped from the fusion
      // surface, since the compliance layer relies on their presence to fail
      // closed to REVIEW.
      for (const [key, fieldData] of Object.entries(extractedFields || {})) {
        if (!(key in fused.fusedFields)) {
          fused.fusedFields[key] = {
            ...fieldData,
            spatialRelationToPdp: "UNKNOWN",
            fusionReason: "REVIEW declaration preserved through fusion",
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

    for (const [key, fieldData] of Object.entries(extractedFields || {})) {
      // Never drop a field: REVIEW/UNKNOWN declarations are preserved with an
      // UNKNOWN relation so downstream compliance can fail closed.
      let spatialRelationToPdp = "UNKNOWN";
      let fusionReason = "Field has no usable value for spatial fusion";

      if (!fieldData || fieldData.value === 'REVIEW' || fieldData.value === undefined || fieldData.value === null) {
        fused.fusedFields[key] = {
          ...fieldData,
          spatialRelationToPdp,
          fusionReason: "REVIEW declaration preserved through fusion",
        };
        continue;
      }

      if (fused.pdpDetected && pdpAABB) {
        const fieldBBox = this._resolveFieldBBox(fieldData, ocrDetections, key);
        if (fieldBBox && assertQuadBbox(fieldBBox)) {
          const fieldAABB = getAABB(fieldBBox);
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
          fusionReason = "Field has no usable bbox for spatial fusion";
        }
      } else {
        fusionReason = "PDP not detected; spatial relation unknown";
      }

      fused.fusedFields[key] = {
        ...fieldData,
        spatialRelationToPdp,
        fusionReason
      };
    }

    return fused;
  }

  /**
   * Resolves the spatial bbox of a declaration: prefers the structured bbox
   * carried by the extraction service (which reflects the full label+value
   * region), then falls back to raw OCR string matching.
   */
  static _resolveFieldBBox(fieldData, ocrDetections, key) {
    if (fieldData.bbox && assertQuadBbox(fieldData.bbox)) {
      return fieldData.bbox;
    }

    // Fallback: match the raw OCR detection by text.
    if (fieldData.evidence) {
      const textToFind = String(fieldData.evidence).toLowerCase();
      const match = (ocrDetections || []).find(d =>
        d && String(d.text || '').toLowerCase().includes(textToFind));
      if (match && match.bbox) return match.bbox;
    }

    const valueText = fieldData.value !== null && fieldData.value !== undefined
      ? String(fieldData.value).toLowerCase()
      : null;
    if (valueText) {
      const match = (ocrDetections || []).find(d =>
        d && String(d.text || '').toLowerCase().includes(valueText));
      if (match && match.bbox) return match.bbox;
    }
    return null;
  }
}