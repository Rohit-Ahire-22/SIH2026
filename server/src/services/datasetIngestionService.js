import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Jimp } from 'jimp';

export class DatasetIngestionService {
  /**
   * Evaluates image metrics (dimensions, sharpness, contrast, brightness).
   */
  static async evaluateImage(imagePath) {
    try {
      const image = await Jimp.read(imagePath);
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      const megapixels = (width * height) / 1000000;
      const aspectRatio = width / height;
      
      // Compute basic luminance/brightness/contrast metrics for advisory reporting
      let totalLuminance = 0;
      const pixelCount = width * height;
      
      image.scan(0, 0, width, height, (x, y, idx) => {
        const r = image.bitmap.data[idx];
        const g = image.bitmap.data[idx + 1];
        const b = image.bitmap.data[idx + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += luminance;
      });

      const averageBrightness = totalLuminance / pixelCount;
      
      return {
        width,
        height,
        megapixels,
        aspectRatio,
        averageBrightness,
        sharpness: 'unknown', // complex to calculate without OpenCV, leaving as placeholder
        contrast: 'unknown'
      };
    } catch (e) {
      console.warn(`Failed to process image ${imagePath} with Jimp:`, e.message);
      return {
        width: 0,
        height: 0,
        megapixels: 0,
        aspectRatio: 0,
        averageBrightness: 0,
        sharpness: 'unknown',
        contrast: 'unknown'
      };
    }
  }

  static async computeFileHash(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Concept for ingesting a new post-deployment training candidate.
   * This is a reusable interface that validates, hashes, and queues the image.
   */
  static async ingestNewTrainingCandidate(imagePath, metadata) {
    const stats = await fs.stat(imagePath);
    const fileSizeBytes = stats.size;
    const sha256 = await this.computeFileHash(imagePath);
    const metrics = await this.evaluateImage(imagePath);

    const imageId = crypto.randomUUID();
    
    // The candidate is initially not eligible for training until annotated.
    const candidateRecord = {
      imageId,
      productId: metadata.productId || 'unassigned',
      view: metadata.view || 'other',
      sourceType: metadata.sourceType || 'user_captured',
      ownership: metadata.ownership || 'project_owned',
      originalPath: imagePath,
      extension: path.extname(imagePath).toLowerCase(),
      fileSizeBytes,
      sha256,
      quality: metrics,
      captureTimestamp: metadata.captureTimestamp || new Date().toISOString(),
      annotationStatus: 'pending',
      trainingEligible: false,
      trainingStatus: 'candidate'
    };

    // In a full DB implementation, this would save to the database.
    // For now, we return the structured record.
    return candidateRecord;
  }
}
