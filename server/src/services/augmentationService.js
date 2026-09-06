/**
 * Augmentation Service Blueprint
 * Provides architecture for safe dataset augmentation.
 * Does not execute actual OpenCV/Python image generation; it manages the logical bounds,
 * provenance tracking, and geometric shifts of bounding boxes.
 */

export class AugmentationService {
  /**
   * Generates a metadata record for a newly augmented image, ensuring provenance is tracked.
   */
  static createAugmentedMetadata(sourceImage, parameters, pipelineVersion) {
    if (sourceImage.role !== 'TRAINING') {
      throw new Error(`Cannot augment image assigned to role ${sourceImage.role}. Augmentation restricted to TRAINING set.`);
    }

    return {
      imageId: `aug_${sourceImage.imageId}_${Date.now()}`,
      productId: sourceImage.productId, // Product ID remains the same! Does not inflate unique product count.
      role: 'TRAINING',
      provenance: 'synthetic',
      sourceImageId: sourceImage.imageId,
      sourceAnnotationVersion: sourceImage.annotationVersion || 'unknown',
      augmentationPipelineVersion: pipelineVersion,
      augmentationParameters: parameters
    };
  }

  /**
   * Mathematically transforms a YOLO bounding box [cx, cy, w, h] based on a scale and shift operation.
   * Note: YOLO coordinates are normalized [0.0 - 1.0].
   * 
   * @param {Array} yoloBbox [cx, cy, w, h]
   * @param {Object} params { scaleX, scaleY, shiftX, shiftY } (shifts are relative to width/height, e.g. 0.1 for 10% right)
   * @returns {Array|null} New bbox, or null if the box is pushed entirely off-screen.
   */
  static transformBoundingBox(yoloBbox, params) {
    let [cx, cy, w, h] = yoloBbox;
    
    // Apply shift (translation)
    cx += (params.shiftX || 0);
    cy += (params.shiftY || 0);

    // Apply scale (zoom)
    // If the image is zoomed IN (scale > 1), the box takes up MORE of the normalized space.
    const scaleX = params.scaleX || 1.0;
    const scaleY = params.scaleY || 1.0;
    
    cx = cx * scaleX;
    cy = cy * scaleY;
    w = w * scaleX;
    h = h * scaleY;

    // Reject if center is completely off screen
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1) {
      return null; 
    }

    // Clip width/height if they exceed image boundaries based on center
    const x1 = Math.max(0, cx - (w / 2));
    const y1 = Math.max(0, cy - (h / 2));
    const x2 = Math.min(1.0, cx + (w / 2));
    const y2 = Math.min(1.0, cy + (h / 2));

    const newW = x2 - x1;
    const newH = y2 - y1;

    if (newW <= 0 || newH <= 0) return null;

    const newCx = x1 + (newW / 2);
    const newCy = y1 + (newH / 2);

    return [newCx, newCy, newW, newH];
  }
}
