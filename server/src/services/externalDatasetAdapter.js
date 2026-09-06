/**
 * External Dataset Adapter
 * Provides an abstract architecture to ingest, validate, and normalize 
 * external datasets into the SIH YOLO architecture.
 */

export class ExternalDatasetAdapter {
  constructor(config) {
    this.datasetName = config.datasetName;
    this.license = config.license;
    this.classMappings = config.classMappings || {}; // e.g. { "generic_package": { targetId: 0, confidence: "high" } }
  }

  /**
   * Evaluates if the license permits our specific commercial/SIH use case.
   */
  validateLicense() {
    const restricted = ['research_only', 'non_commercial', 'proprietary'];
    if (restricted.includes(this.license.type)) {
      throw new Error(`License ${this.license.type} prevents automated ingestion for SIH. Manual clearance required.`);
    }
    return true;
  }

  /**
   * Maps an external string/ID class to the authoritative SIH YOLO ID
   * @param {string} sourceClass 
   * @returns {number|null} The SIH class ID (0, 1, or 2) or null if unmappable
   */
  mapClass(sourceClass) {
    const mapping = this.classMappings[sourceClass];
    if (!mapping) return null;

    // Explicitly reject low-confidence semantic mappings (e.g., text -> declaration_panel)
    if (mapping.confidence === 'low') {
      console.warn(`[WARN] Rejected mapping for ${sourceClass} due to low semantic confidence.`);
      return null;
    }

    return mapping.targetId;
  }

  /**
   * Normalizes an external bounding box format into [x_center, y_center, w, h] [0-1]
   */
  normalizeBox(boxData, imageWidth, imageHeight) {
    throw new Error("normalizeBox must be implemented by the specific dataset adapter subclass.");
  }

  /**
   * Base ingestion framework enforcing provenance tracking
   */
  ingestAnnotation(sourceMetadata, boxData, sourceClass, imageWidth, imageHeight) {
    this.validateLicense();
    
    const targetId = this.mapClass(sourceClass);
    if (targetId === null) return null;

    const normalizedBox = this.normalizeBox(boxData, imageWidth, imageHeight);

    return {
      classId: targetId,
      bbox: normalizedBox,
      provenance: 'external_dataset',
      sourceDataset: this.datasetName,
      sourceLicense: this.license.type,
      sourceAnnotationId: sourceMetadata.id || 'unknown',
      originalClass: sourceClass
    };
  }
}
