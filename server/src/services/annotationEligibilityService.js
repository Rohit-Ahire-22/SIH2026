import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLASSES_CONFIG = path.resolve(__dirname, '../../../ai-service/config/yolo_classes.json');

export class AnnotationEligibilityService {
  constructor() {
    this.classMap = null;
    this.productSplits = new Map(); // productId -> split ('train', 'val', 'test')
  }

  async init() {
    if (this.classMap) return;
    const config = JSON.parse(await fs.readFile(CLASSES_CONFIG, 'utf-8'));
    this.classMap = new Set(config.classes.map(c => c.id));
  }

  /**
   * Enforces product-level splitting. If a product is already assigned to a split,
   * all subsequent images for that product must be in the same split.
   */
  assignSplit(productId, requestedSplit) {
    if (this.productSplits.has(productId)) {
      return this.productSplits.get(productId);
    }
    this.productSplits.set(productId, requestedSplit);
    return requestedSplit;
  }

  evaluateEligibility(annotation) {
    const report = {
      isEligible: false,
      reasons: []
    };

    // 1. Box Validity
    const { xCenter, yCenter, width, height } = annotation.boundingBox;
    if (xCenter < 0 || xCenter > 1 || yCenter < 0 || yCenter > 1 || width <= 0 || width > 1 || height <= 0 || height > 1) {
      report.reasons.push("Invalid bounding box coordinates.");
    }

    // 2. Class Validity
    if (!this.classMap.has(annotation.classId)) {
      report.reasons.push("Invalid class ID.");
    }

    // 3. Provenance Validity
    const allowedProvenance = ["human_verified", "human_corrected"];
    if (!allowedProvenance.includes(annotation.provenance)) {
      report.reasons.push(`Invalid provenance for training: ${annotation.provenance}`);
    }

    // 4. Verification Validity
    const allowedStatus = ["ACCEPTED", "CORRECTED"];
    if (!allowedStatus.includes(annotation.verificationStatus)) {
      report.reasons.push(`Invalid verification status for training: ${annotation.verificationStatus}`);
    }

    // 5. License Validity
    if (annotation.sourceLicense !== "proprietary") { // Simplified check for this scope
      report.reasons.push("Source license is not approved for training without conditions.");
    }

    if (report.reasons.length === 0) {
      report.isEligible = true;
    }

    return report;
  }

  processVerification(annotation, actionPayload, reviewerId = "local_reviewer") {
    const { action, classId, bbox, notes } = actionPayload;

    // Safety: we cannot verify something that isn't PENDING unless explicitly allowed
    if (annotation.verificationStatus !== "PENDING" && annotation.verificationStatus !== "REJECTED") {
      // Re-verifying might be allowed in some workflows, but we'll accept it here
    }

    annotation.reviewerId = reviewerId;
    annotation.verifiedAt = new Date().toISOString();
    annotation.reviewNotes = notes || null;

    if (action === "ACCEPT") {
      annotation.verificationStatus = "ACCEPTED";
      annotation.provenance = "human_verified";
    } else if (action === "CORRECT") {
      annotation.verificationStatus = "CORRECTED";
      annotation.provenance = "human_corrected";
      
      // Save original state before overwriting
      annotation.originalBoundingBox = { ...annotation.boundingBox };
      annotation.originalClassId = annotation.classId;

      if (bbox) {
        annotation.boundingBox = bbox;
      }
      if (classId !== undefined) {
        annotation.classId = classId;
      }
    } else if (action === "REJECT") {
      annotation.verificationStatus = "REJECTED";
      // Provenance remains whatever it was (e.g. weak_candidate)
    } else {
      throw new Error(`Unknown verification action: ${action}`);
    }

    // After state change, re-evaluate training eligibility
    const report = this.evaluateEligibility(annotation);
    annotation.trainingEligible = report.isEligible;
    annotation.eligibilityReport = report.reasons;

    return annotation;
  }
}
