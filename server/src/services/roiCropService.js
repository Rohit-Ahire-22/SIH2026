import { Jimp } from 'jimp';
/**
 * ROI Crop Service
 * Generates an in-memory image buffer based on a normalized YOLO bounding box.
 */
export class RoiCropService {
  /**
   * Crops the given image buffer using a YOLO bounding box.
   *
   * @param {Buffer} imageBuffer The original image buffer.
   * @param {string} mimeType The MIME type of the original image (e.g. 'image/jpeg').
   * @param {Array} yoloBbox Normalized bounding box [cx, cy, w, h] in range 0.0 - 1.0.
   * @param {Object|null} jimpImage Optional pre-decoded Jimp image to avoid re-reading the buffer.
   *   When provided, the buffer is only used to produce the final encoded crop; the image
   *   dimensions and pixel data come from the already-decoded object, eliminating one
   *   Jimp.read() call per ROI crop.
   * @returns {Promise<Object>} { buffer, width, height, bboxOriginal: { x1, y1, x2, y2 } }
   */
  static async cropRegion(imageBuffer, mimeType, yoloBbox, jimpImage = null) {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      throw new Error("Invalid image buffer provided for ROI crop.");
    }
    if (!yoloBbox || yoloBbox.length !== 4) {
      throw new Error("Invalid YOLO bounding box format.");
    }
    const [cx, cy, normW, normH] = yoloBbox;
    // Prevent meaningless crops
    if (normW <= 0 || normH <= 0) {
      throw new Error("ROI dimensions must be greater than zero.");
    }
    // Re-use a pre-decoded Jimp image when available to avoid a second decode.
    const image = jimpImage !== null ? jimpImage.clone() : await Jimp.read(imageBuffer);
    const imgWidth = image.bitmap.width;
    const imgHeight = image.bitmap.height;
    // Convert YOLO normalized to absolute coordinates
    const absW = normW * imgWidth;
    const absH = normH * imgHeight;
    const absCx = cx * imgWidth;
    const absCy = cy * imgHeight;
    let x1 = Math.round(absCx - (absW / 2));
    let y1 = Math.round(absCy - (absH / 2));
    let x2 = Math.round(absCx + (absW / 2));
    let y2 = Math.round(absCy + (absH / 2));
    // Clip to image boundaries
    x1 = Math.max(0, Math.min(x1, imgWidth));
    y1 = Math.max(0, Math.min(y1, imgHeight));
    x2 = Math.max(0, Math.min(x2, imgWidth));
    y2 = Math.max(0, Math.min(y2, imgHeight));
    const cropW = x2 - x1;
    const cropH = y2 - y1;
    if (cropW <= 0 || cropH <= 0) {
      throw new Error("ROI crop resulted in zero dimensions after boundary clipping.");
    }
    // Crop the image
    image.crop({ x: x1, y: y1, w: cropW, h: cropH });
    // Ensure we encode back to the correct format (Jimp infers from mime)
    const croppedBuffer = await image.getBuffer(mimeType);
    return {
      buffer: croppedBuffer,
      width: cropW,
      height: cropH,
      bboxOriginal: {
        x1, y1, x2, y2
      }
    };
  }
}
