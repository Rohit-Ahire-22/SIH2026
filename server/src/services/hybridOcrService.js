import { fetchRemoteImage, runOcrOnImageBuffer } from './ocrClientService.js';
import { generateDeclarationCandidates } from './weakRoiCandidateService.js';
import { RoiCropService } from './roiCropService.js';
import { Jimp } from 'jimp';

/**
 * Hybrid OCR / Geometry ROI Inference Engine
 * Strategy D Implementation
 */

export class HybridOcrService {
  /**
   * Executes the full Hybrid OCR pipeline.
   * @param {string} imageUrl URL of the original image
   * @param {string} mimeType MIME type
   * @returns {Promise<Object>} Fused OCR results and metrics
   */
  static async runHybridOcr(imageUrl, mimeType) {
    const startTime = Date.now();
    let imageBuffer;
    let imgWidth = 0;
    let imgHeight = 0;
    
    // 1. Fetch image
    try {
      imageBuffer = await fetchRemoteImage(imageUrl);
      const img = await Jimp.read(imageBuffer);
      imgWidth = img.bitmap.width;
      imgHeight = img.bitmap.height;
    } catch (err) {
      throw new Error(`Failed to initialize image for Hybrid OCR: ${err.message}`);
    }

    // 2. Full-Image OCR
    let fullImageResults = [];
    try {
      fullImageResults = await runOcrOnImageBuffer(imageBuffer, mimeType);
    } catch (err) {
      // If full OCR fails, we cannot generate ROI candidates.
      throw new Error(`Full-image OCR failed: ${err.message}`);
    }

    // Tag provenance
    fullImageResults.forEach(r => r.source = 'full_image');

    // 3. Generate ROI Candidates
    const candidateResponse = generateDeclarationCandidates(fullImageResults, { width: imgWidth, height: imgHeight });
    
    if (candidateResponse.status !== 'candidate_generated' || !candidateResponse.candidates.length) {
      // Return gracefully with just full image results
      return this._buildResponse(fullImageResults, [], [], startTime);
    }

    // Limit candidates for performance (max 3)
    const candidates = candidateResponse.candidates.slice(0, 3);
    const roiDetections = [];
    const validRoiEvidence = [];

    // 4. Crop & ROI OCR
    for (const [index, candidate] of candidates.entries()) {
      try {
        const cropResult = await RoiCropService.cropRegion(imageBuffer, mimeType, candidate.bbox);
        
        // Run OCR on crop
        const cropOcrResults = await runOcrOnImageBuffer(cropResult.buffer, mimeType);
        
        // 5. Reproject coordinates back to original image space
        const { x1, y1 } = cropResult.bboxOriginal;
        
        const reprojectedResults = cropOcrResults.map(r => {
          // r.bbox is [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] relative to crop
          const reprojectedBbox = r.bbox.map(point => [
            point[0] + x1,
            point[1] + y1
          ]);

          return {
            ...r,
            bbox: reprojectedBbox,
            source: 'roi',
            roiCandidateId: `roi_${index}`,
            roiType: candidate.className,
            candidateConfidence: candidate.confidence
          };
        });

        roiDetections.push(...reprojectedResults);
        
        validRoiEvidence.push({
          candidateId: `roi_${index}`,
          type: candidate.className,
          confidence: candidate.confidence,
          bbox: cropResult.bboxOriginal,
          detectionCount: reprojectedResults.length
        });

      } catch (err) {
        // Skip failed crops/OCRs
        console.warn(`[HybridOCR] Failed to process candidate ROI ${index}: ${err.message}`);
      }
    }

    // 6. Fuse Results
    const fusedResults = this.fuseOcrResults(fullImageResults, roiDetections);

    return this._buildResponse(fusedResults, validRoiEvidence, candidates, startTime, fullImageResults.length, roiDetections.length);
  }

  static _buildResponse(fusedResults, roiEvidence, rawCandidates, startTime, fullCount = 0, roiCount = 0) {
    return {
      success: true,
      mode: 'hybrid',
      runtimeMs: Date.now() - startTime,
      fullImageDetections: fullCount || fusedResults.length, // Fallback if no ROI
      roiCandidates: rawCandidates.length,
      roiDetections: roiCount,
      fusedDetections: fusedResults.length,
      roiEvidence,
      results: fusedResults
    };
  }

  /**
   * Fuses full-image and ROI OCR results, prioritizing ROI results when there is spatial overlap.
   */
  static fuseOcrResults(fullResults, roiResults) {
    if (!roiResults.length) return fullResults;

    const fused = [...roiResults]; // We trust ROI detections more (higher resolution crop)

    for (const fullRes of fullResults) {
      const fullBbox = fullRes.bbox;
      const fullBoxCenter = [
        (fullBbox[0][0] + fullBbox[2][0]) / 2,
        (fullBbox[0][1] + fullBbox[2][1]) / 2
      ];

      // Check if this full image detection falls completely inside or heavily overlaps any ROI detection
      let isDuplicate = false;
      
      for (const roiRes of roiResults) {
        // Simple point-in-polygon (or bounding box bounds) check for deduplication
        const rxMin = roiRes.bbox[0][0];
        const rxMax = roiRes.bbox[2][0];
        const ryMin = roiRes.bbox[0][1];
        const ryMax = roiRes.bbox[2][1];

        // Give a little margin for error (e.g. 5px)
        const margin = 5;
        if (fullBoxCenter[0] >= rxMin - margin && fullBoxCenter[0] <= rxMax + margin &&
            fullBoxCenter[1] >= ryMin - margin && fullBoxCenter[1] <= ryMax + margin) {
          
          // If the text is substantially similar, it's a duplicate
          if (this._textSimilarity(fullRes.text, roiRes.text) > 0.6) {
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        fused.push(fullRes);
      }
    }

    return fused;
  }

  /**
   * Extremely simple text similarity (Jaccard-like or character overlap)
   */
  static _textSimilarity(t1, t2) {
    const s1 = t1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = t2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!s1 || !s2) return 0;
    
    // Longest common substring would be better, but exact/includes is fine for OCR deduplication
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    return 0;
  }
}
