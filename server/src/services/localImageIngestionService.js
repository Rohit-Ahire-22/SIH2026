import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ImageDeduplicationService } from './imageDeduplicationService.js';
import { inferViewFromFilename, inferCategory } from './imageMetadataService.js';

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp)$/i;

const EXTENSION_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function round(value, decimals = 4) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Scans a local proprietary raw directory, fingerprints every image
 * (SHA-256 + dHash), measures dimensions, infers view/category, and maintains
 * a backward-compatible image manifest at product level.
 *
 * Exact duplicates are rejected (decision recorded, nothing deleted).
 * Near duplicates are flagged but RETAINED so product/view identity survives.
 * Malformed/undecodable images fail the quality gate safely and are skipped.
 */
export class LocalImageIngestionService {
  /**
   * @param {object} opts
   * @param {string} opts.rawRoot            directory scanned for product folders
   * @param {string} opts.manifestPath       dataset/config/image-manifest.json
   * @param {number} [opts.nearDuplicateThreshold=10] dHash bits -> near_duplicate
   * @param {number} [opts.reviewThreshold=18]        dHash bits -> review flag
   * @param {object} [opts.categoryOverrides={}]      productId -> category (explicit metadata)
   */
  constructor({ rawRoot, manifestPath, nearDuplicateThreshold = 10, reviewThreshold = 18, categoryOverrides = {} }) {
    this.rawRoot = rawRoot;
    this.manifestPath = manifestPath;
    this.nearDuplicateThreshold = nearDuplicateThreshold;
    this.reviewThreshold = reviewThreshold;
    this.categoryOverrides = categoryOverrides;
  }

  assignSplit(productId) {
    const seed = crypto.createHash('md5').update(productId).digest('hex').substring(0, 8);
    const bucket = parseInt(seed, 16) % 10;
    if (bucket < 7) return 'train';
    if (bucket < 9) return 'validation';
    return 'test';
  }

  async loadManifest() {
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      if (!Array.isArray(manifest.images)) manifest.images = [];
      if (!manifest.productSplits || typeof manifest.productSplits !== 'object') {
        manifest.productSplits = {};
      }
      return manifest;
    } catch {
      return { images: [], productSplits: {} };
    }
  }

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.includeUnregisteredProducts=false]
   *   When true, brand-new product folders are registered (future production uploads).
   *   When false (default), only products already present in the manifest are enriched,
   *   so the existing seed membership is never changed silently.
   */
  async ingest({ includeUnregisteredProducts = false } = {}) {
    const manifest = await this.loadManifest();

    const byKey = new Map();
    const byHash = new Map();
    for (const img of manifest.images) {
      if (img.relativePath) byKey.set(img.relativePath, img);
      if (img.hash && !byHash.has(img.hash)) byHash.set(img.hash, img);
    }

    const duplicateLog = [];
    const summary = {
      generatedAt: new Date().toISOString(),
      productsScanned: 0,
      rawFilesScanned: 0,
      imported: 0,
      enriched: 0,
      exactDuplicates: 0,
      nearDuplicates: 0,
      review: 0,
      malformed: 0,
      uniqueProducts: 0,
      totalImagesInManifest: manifest.images.length
    };

    let dirs = [];
    try {
      dirs = await fs.readdir(this.rawRoot);
    } catch {
      return summary;
    }

    for (const productDir of dirs) {
      if (!includeUnregisteredProducts && !manifest.productSplits[productDir]) {
        continue;
      }
      const fullProductPath = path.join(this.rawRoot, productDir);
      const stat = await fs.stat(fullProductPath).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      summary.productsScanned++;

      const files = await fs.readdir(fullProductPath);
      for (const file of files) {
        if (!IMAGE_EXTENSION_RE.test(file)) continue;
        summary.rawFilesScanned++;

        // A product only claims its deterministic split once it has a real image.
        const split = manifest.productSplits[productDir] || (manifest.productSplits[productDir] = this.assignSplit(productDir));

        // Portability: manifests always use forward-slash relative paths.
        const relativePath = path.posix.join(productDir, file);
        const filePath = path.join(fullProductPath, file);

        let buffer;
        try {
          buffer = await fs.readFile(filePath);
        } catch {
          summary.malformed++;
          continue;
        }
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const fileSize = buffer.length;

        const shaOwner = byHash.get(sha256);
        const knownByPath = byKey.get(relativePath);
        // Legacy records registered before this step have no relativePath. Only those
        // can be re-matched by sha within the same product; once a record has a path,
        // any other file with identical bytes is an exact duplicate.
        const knownByHashSameProduct =
          shaOwner && shaOwner.productId === productDir && !shaOwner.relativePath ? shaOwner : null;
        const sameLogicalImage = knownByPath || knownByHashSameProduct;
        if (sameLogicalImage) {
          // Same logical image re-run: enrich metadata, never re-register.
          const record = sameLogicalImage;
          await this.enrichRecord(record, relativePath, filePath, buffer, sha256, fileSize, productDir, file, split);
          if (!byKey.has(relativePath)) byKey.set(relativePath, record);
          summary.enriched++;
          continue;
        }

        if (shaOwner) {
          summary.exactDuplicates++;
          duplicateLog.push({
            relativePath,
            status: 'exact_duplicate',
            reason: `SHA-256 matches ${shaOwner.relativePath || shaOwner.imageId}`,
            duplicateOf: shaOwner.imageId || shaOwner.relativePath
          });
          continue;
        }

        // Quality gate: the image must decode; dimensions come from the actual image.
        const dims = await ImageDeduplicationService.decodeDimensions(filePath);
        if (!dims) {
          summary.malformed++;
          duplicateLog.push({ relativePath, status: 'malformed', reason: 'image could not be decoded' });
          continue;
        }

        let dHash;
        try {
          dHash = await ImageDeduplicationService.dHashHexFromBuffer(buffer);
        } catch {
          summary.malformed++;
          continue;
        }

        const decision = ImageDeduplicationService.classifyDuplicate({
          sha256,
          dHash,
          existingRecords: manifest.images,
          nearDuplicateThreshold: this.nearDuplicateThreshold,
          reviewThreshold: this.reviewThreshold
        });

        if (decision.status === 'near_duplicate') summary.nearDuplicates++;
        if (decision.status === 'review') summary.review++;

        const viewInfo = inferViewFromFilename(file);
        const categoryInfo = inferCategory({
          productFolder: productDir,
          fileName: file,
          explicitMetadataCategory: this.categoryOverrides[productDir]
        });

        const extension = path.extname(file).toLowerCase();
        let baseId = `${productDir}_${viewInfo.view}`;
        let imageId = baseId;
        let suffix = 2;
        while (manifest.images.some((r) => r.imageId === imageId && r.relativePath !== relativePath)) {
          imageId = `${baseId}_${suffix++}`;
        }

        const record = {
          imageId,
          productId: productDir,
          view: viewInfo.view,
          viewSource: viewInfo.viewSource,
          relativePath,
          source: 'proprietary_smartphone',
          sourceLicense: 'proprietary',
          acquisitionTimestamp: new Date().toISOString(),
          extension,
          mimeType: dims.mimeType || EXTENSION_MIME[extension] || 'unknown',
          width: dims.width,
          height: dims.height,
          aspectRatio: round(dims.width / dims.height),
          fileSize,
          hash: sha256,
          sha256,
          dHash,
          duplicateStatus: decision.status,
          duplicateReason: decision.reason,
          duplicateOf: decision.duplicateOf,
          split,
          category: categoryInfo.category,
          categorySource: categoryInfo.categorySource,
          ...(categoryInfo.categoryConfidence !== undefined ? { categoryConfidence: categoryInfo.categoryConfidence } : {})
        };

        manifest.images.push(record);
        byKey.set(relativePath, record);
        byHash.set(sha256, record);
        summary.imported++;
      }
    }

    manifest.lastIngestionSummary = summary;
    manifest.duplicateLog = duplicateLog;

    await fs.mkdir(path.dirname(this.manifestPath), { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));

    summary.uniqueProducts = Object.keys(manifest.productSplits).length;
    summary.totalImagesInManifest = manifest.images.length;
    return summary;
  }

  async enrichRecord(record, relativePath, filePath, buffer, sha256, fileSize, productDir, file, split) {
    const dims = await ImageDeduplicationService.decodeDimensions(filePath);
    let dHash = null;
    try {
      dHash = await ImageDeduplicationService.dHashHexFromBuffer(buffer);
    } catch {
      dHash = record.dHash || null;
    }

    const viewInfo = inferViewFromFilename(file);
    const categoryInfo = inferCategory({
      productFolder: productDir,
      fileName: file,
      explicitMetadataCategory: this.categoryOverrides[productDir]
    });

    const extension = path.extname(file).toLowerCase();
    record.hash = record.hash || sha256;
    record.sha256 = sha256;
    record.dHash = dHash;
    record.fileSize = fileSize;
    record.extension = extension;
    record.relativePath = relativePath;
    record.mimeType = dims ? dims.mimeType || EXTENSION_MIME[extension] || 'unknown' : record.mimeType || EXTENSION_MIME[extension] || 'unknown';
    if (dims) {
      record.width = dims.width;
      record.height = dims.height;
      record.aspectRatio = round(dims.width / dims.height);
    }
    record.view = viewInfo.view;
    record.viewSource = viewInfo.viewSource;
    record.category = categoryInfo.category;
    record.categorySource = categoryInfo.categorySource;
    if (categoryInfo.categoryConfidence !== undefined) {
      record.categoryConfidence = categoryInfo.categoryConfidence;
    }
    record.duplicateStatus = record.duplicateStatus || 'unique';
    record.duplicateReason = record.duplicateReason || 'registered_image';
    record.duplicateOf = record.duplicateOf || null;
    record.split = split;
  }
}