import fs from 'fs/promises';
import path from 'path';

/**
 * Deterministic verification-priority queue generation.
 *
 * The queue is rebuilt fresh on every run (no duplication possible) and items
 * are ordered purely by deterministic keys: priority then productId/imageId/
 * filePath. Nothing is randomly shuffled.
 *
 * Priority model (best = 1): declaration-heavy -> back -> underrepresented
 * category -> product/category not yet verified -> remaining candidates.
 */
export class VerificationQueueService {
  static PRIORITY_MODEL = [
    { priority: 1, label: 'declaration_panel candidate' },
    { priority: 2, label: 'back-panel view' },
    { priority: 3, label: 'underrepresented category' },
    { priority: 4, label: 'product lacks verified annotation' },
    { priority: 5, label: 'remaining unannotated candidate' }
  ];

  /**
   * @param {object} opts
   * @param {string} opts.manifestPath         dataset/config/image-manifest.json
   * @param {string} opts.annotationsPath      dataset/annotations/master-annotations.json
   * @param {string} opts.sourceRegistryPath   dataset/config/source-registry.json
   * @param {Array<string>} [opts.eligibleAnnotationStatuses=['PENDING']]
   * @returns {Promise<{items: object[], excluded: object, counts: object}>}
   */
  static async buildQueue({
    manifestPath,
    annotationsPath,
    sourceRegistryPath,
    eligibleAnnotationStatuses = ['PENDING']
  }) {
    const [manifestRaw, annotationsRaw, registryRaw] = await Promise.all([
      fs.readFile(manifestPath, 'utf-8'),
      fs.readFile(annotationsPath, 'utf-8'),
      fs.readFile(sourceRegistryPath, 'utf-8')
    ]);
    const manifest = JSON.parse(manifestRaw);
    const annotations = JSON.parse(annotationsRaw);
    const registry = JSON.parse(registryRaw);

    const approvedLicenses = new Set(
      registry.registry
        .filter((r) => r.approvalStatus === 'APPROVED')
        .map((r) => r.license.toLowerCase())
    );

    const annotationByImage = new Map();
    for (const ann of annotations) {
      annotationByImage.set(ann.imageId, ann);
    }

    const verifiedProductIds = new Set(
      annotations
        .filter((a) => a.verificationStatus === 'ACCEPTED' || a.verificationStatus === 'CORRECTED')
        .map((a) => a.productId)
    );

    const categoryCounts = new Map();
    const productCounts = new Map();
    for (const img of manifest.images) {
      const cat = img.category || 'unknown';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      productCounts.set(img.productId, (productCounts.get(img.productId) || 0) + 1);
    }

    const excluded = {
      licenseBlocked: 0,
      exactDuplicates: 0,
      malformed: 0,
      humanVerified: 0,
      rejected: 0
    };

    const items = [];
    for (const img of manifest.images) {
      // License / provenance gate (source registry is authoritative).
      if (!approvedLicenses.has((img.sourceLicense || '').toLowerCase())) {
        excluded.licenseBlocked++;
        continue;
      }

      // Exact duplicates must never enter the queue.
      if (img.duplicateStatus === 'exact_duplicate') {
        excluded.exactDuplicates++;
        continue;
      }
      if (img.duplicateStatus === 'malformed') {
        excluded.malformed++;
        continue;
      }

      const annotation = annotationByImage.get(img.imageId);
      if (annotation) {
        if (annotation.verificationStatus === 'ACCEPTED' || annotation.verificationStatus === 'CORRECTED') {
          excluded.humanVerified++;
          continue;
        }
        if (annotation.verificationStatus === 'REJECTED') {
          excluded.rejected++;
          continue;
        }
      }

      const isEligibleByAnnotation =
        !annotation || eligibleAnnotationStatuses.includes(annotation.verificationStatus);
      if (!isEligibleByAnnotation) continue;

      let priority = 5;
      const priorityReasons = [];
      const declarationHeavy =
        img.view === 'declaration' ||
        (annotation && (annotation.className === 'declaration_panel' || annotation.classId === 2));
      const isBackView = img.view === 'back';
      const categoryCount = categoryCounts.get(img.category || 'unknown') || 0;
      const productCount = productCounts.get(img.productId) || 0;
      const underrepresentedCategory = categoryCount > 0 && categoryCount <= 1;
      const productNotVerified = !verifiedProductIds.has(img.productId) || productCount <= 1;

      if (declarationHeavy) {
        priority = 1;
        priorityReasons.push('declaration_panel candidate');
        if (img.view === 'declaration') priorityReasons.push('declaration view');
      } else if (isBackView) {
        priority = 2;
        priorityReasons.push('back-panel view');
      } else if (underrepresentedCategory) {
        priority = 3;
        priorityReasons.push('underrepresented category');
      } else if (productNotVerified) {
        priority = 4;
        priorityReasons.push('product lacks verified annotation');
      } else {
        priority = 5;
        priorityReasons.push('remaining unannotated candidate');
      }

      if (img.duplicateStatus === 'near_duplicate' || img.duplicateStatus === 'review') {
        priorityReasons.push('flagged for perceptual duplicate review');
      }

      items.push({
        imageId: img.imageId,
        productId: img.productId,
        filePath: img.relativePath,
        view: img.view,
        category: img.category || 'unknown',
        priority,
        priorityReasons,
        annotationStatus: annotation ? annotation.verificationStatus : 'NO_ANNOTATION',
        provenance: annotation ? annotation.provenance : 'none'
      });
    }

    // Deterministic order: lowest priority number first, then stable keys.
    items.sort(
      (a, b) =>
        a.priority - b.priority ||
        a.productId.localeCompare(b.productId) ||
        a.imageId.localeCompare(b.imageId) ||
        a.filePath.localeCompare(b.filePath)
    );

    return {
      items,
      excluded,
      counts: { totalQueue: items.length }
    };
  }

  static async writeQueueFile({ queuePath, sourceRegistryPath, manifestPath }) {
    const result = await VerificationQueueService.buildQueue({
      manifestPath,
      annotationsPath: path.join(path.dirname(manifestPath), '../annotations/master-annotations.json'),
      sourceRegistryPath
    });

    const output = {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      deterministicOrder: 'priority | productId | imageId | filePath',
      priorityModel: VerificationQueueService.PRIORITY_MODEL,
      ...result
    };

    await fs.mkdir(path.dirname(queuePath), { recursive: true });
    await fs.writeFile(queuePath, JSON.stringify(output, null, 2));
    return output;
  }
}