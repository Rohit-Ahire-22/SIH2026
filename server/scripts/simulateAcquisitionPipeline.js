import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dummy constants for pipeline simulation
const VALID_LICENSES = ['proprietary'];
const MIN_RESOLUTION = 300; // pixels

class AcquisitionPipeline {
  constructor() {
    this.queue = [];
    this.db = new Map();
  }

  hashImage(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  enqueue(imageMetadata) {
    imageMetadata.state = 'DISCOVERED';
    this.queue.push(imageMetadata);
  }

  processQueue() {
    for (const item of this.queue) {
      this.transition(item);
    }
  }

  transition(item) {
    switch (item.state) {
      case 'DISCOVERED':
        item.state = 'LICENSE_PENDING';
        break;
      case 'LICENSE_PENDING':
        if (VALID_LICENSES.includes(item.license)) {
          item.state = 'LICENSE_APPROVED';
        } else {
          item.state = 'REJECTED';
          item.rejectionReason = 'Invalid or unknown license';
        }
        break;
      case 'LICENSE_APPROVED':
        item.state = 'DOWNLOADED';
        break;
      case 'DOWNLOADED':
        // Quality Gate
        if (item.width >= MIN_RESOLUTION && item.height >= MIN_RESOLUTION) {
          item.state = 'VALIDATED';
        } else {
          item.state = 'REJECTED';
          item.rejectionReason = 'Failed quality gate';
        }
        break;
      case 'VALIDATED':
        // Duplicate Check
        if (this.db.has(item.hash)) {
          item.state = 'REJECTED';
          item.rejectionReason = 'Duplicate SHA-256 hash';
        } else {
          this.db.set(item.hash, item);
          item.state = 'DUPLICATE_CHECKED';
        }
        break;
      case 'DUPLICATE_CHECKED':
        // Provenance Check
        if (item.sourceUrl && item.acquisitionTimestamp) {
          item.state = 'PROVENANCE_COMPLETE';
        } else {
          item.state = 'REJECTED';
          item.rejectionReason = 'Incomplete provenance';
        }
        break;
      case 'PROVENANCE_COMPLETE':
        item.state = 'ANNOTATION_PENDING';
        break;
      case 'ANNOTATION_PENDING':
        // Simulating human verification workflow
        if (item.humanVerified) {
          item.state = 'VERIFIED';
        } else if (item.hasWeakCandidate) {
          // Stays in pending but could be ranked higher
        }
        break;
      case 'VERIFIED':
        item.state = 'TRAINING_ELIGIBLE';
        break;
    }

    // Recursively process if not halted
    if (item.state !== 'REJECTED' && item.state !== 'TRAINING_ELIGIBLE' && item.state !== 'ANNOTATION_PENDING') {
      this.transition(item);
    }
  }

  calculateMilestone(uniqueProducts, verifiedAnnotations) {
    if (uniqueProducts >= 100 && verifiedAnnotations >= 200) return 'MILESTONE_D';
    if (uniqueProducts >= 75 && verifiedAnnotations >= 150) return 'MILESTONE_C';
    if (uniqueProducts >= 50 && verifiedAnnotations >= 100) return 'MILESTONE_B';
    if (uniqueProducts >= 25 && verifiedAnnotations >= 50) return 'MILESTONE_A';
    return 'PRE_MILESTONE';
  }
}

export { AcquisitionPipeline };
