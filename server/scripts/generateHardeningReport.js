import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const MANIFEST_PATH = path.join(DATASET_DIR, 'config', 'image-manifest.json');
const VERIFICATION_QUEUE_PATH = path.join(DATASET_DIR, 'config', 'verification-queue.json');
const MASTER_ANNOTATIONS_PATH = path.join(DATASET_DIR, 'annotations', 'master-annotations.json');
const SOURCE_REGISTRY_PATH = path.join(DATASET_DIR, 'config', 'source-registry.json');
const REPORTS_DIR = path.join(DATASET_DIR, 'reports', 'acquisition');

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function generateHardeningReport() {
  const manifest = await loadJson(MANIFEST_PATH, { images: [], productSplits: {} });
  const queue = await loadJson(VERIFICATION_QUEUE_PATH, { items: [] });
  const annotations = await loadJson(MASTER_ANNOTATIONS_PATH, []);
  const registry = await loadJson(SOURCE_REGISTRY_PATH, { registry: [] });

  const images = manifest.images || [];
  const productSplits = manifest.productSplits || {};

  const uniqueProducts = Object.keys(productSplits).length;

  const views = { front: 0, back: 0, declaration: 0, unknown: 0 };
  const categories = {};
  for (const img of images) {
    const view = img.view && views[img.view] !== undefined ? img.view : 'unknown';
    views[view]++;
    const cat = img.category || 'unknown';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  const widths = images.filter((i) => i.width).map((i) => i.width);
  const heights = images.filter((i) => i.height).map((i) => i.height);

  const exactDuplicates = (manifest.duplicateLog || []).filter((d) => d.status === 'exact_duplicate').length;
  const nearDuplicatesInManifest = images.filter((i) => i.duplicateStatus === 'near_duplicate').length;
  const reviewInManifest = images.filter((i) => i.duplicateStatus === 'review').length;
  const malformed = (manifest.duplicateLog || []).filter((d) => d.status === 'malformed').length
    || (manifest.lastIngestionSummary && manifest.lastIngestionSummary.malformed) || 0;

  // Human verified annotations (strict provenance gate, never weak candidates).
  let humanVerified = 0;
  for (const a of annotations) {
    if (a.provenance === 'human_verified' || a.provenance === 'human_corrected') {
      if (a.verificationStatus === 'ACCEPTED' || a.verificationStatus === 'CORRECTED') {
        humanVerified++;
      }
    }
  }

  // Split leakage: every image of a product must match the product's split.
  let splitLeakage = 0;
  const productSplitsByName = new Map();
  for (const img of images) {
    const assigned = productSplits[img.productId];
    if (img.split && assigned && img.split !== assigned) splitLeakage++;
  }
  if (splitLeakage > 0) splitLeakage = 1;

  // License blockers: images whose license is not APPROVED in the registry.
  const approvedLicenses = new Set(
    (registry.registry || []).filter((r) => r.approvalStatus === 'APPROVED').map((r) => r.license.toLowerCase())
  );
  const licenseBlockers = images.filter((i) => !approvedLicenses.has((i.sourceLicense || '').toLowerCase())).length;

  const trainingReadiness =
    uniqueProducts >= 50 && humanVerified >= 100 && splitLeakage === 0 ? 'READY_FOR_TRAINING' : 'NOT_READY';

  const report = {
    status: 'STEP 40: PRODUCTION DATASET INGESTION HARDENING',
    stepDisclaimer: 'This step does not make the dataset training-ready.',
    generatedAt: new Date().toISOString(),
    dataset: {
      uniqueProducts,
      totalImages: images.length,
      views: { front: views.front, back: views.back, declaration: views.declaration, unknown: views.unknown },
      categoryDistribution: categories,
      unknownCategoryCount: categories['unknown'] || 0,
      productsWithDeclarationViews: new Set(images.filter((i) => i.view === 'declaration').map((i) => i.productId)).size,
      productsMissingDeclarationViews:
        new Set(images.filter((i) => i.productId).map((i) => i.productId)).size -
        new Set(images.filter((i) => i.view === 'declaration').map((i) => i.productId)).size,
      dimensions: {
        averageWidth: widths.length ? Math.round((widths.reduce((a, b) => a + b, 0) / widths.length) * 10) / 10 : 0,
        averageHeight: heights.length ? Math.round((heights.reduce((a, b) => a + b, 0) / heights.length) * 10) / 10 : 0,
        medianWidth: median(widths),
        medianHeight: median(heights)
      }
    },
    deduplication: {
      exactDuplicates,
      nearDuplicates: nearDuplicatesInManifest + reviewInManifest,
      nearDuplicatesInManifest,
      reviewInManifest,
      uniqueImages: images.filter((i) => i.duplicateStatus === 'unique').length,
      malformed: malformed || 0
    },
    verificationQueue: {
      count: queue.items ? queue.items.length : 0,
      priorityBreakdown: (queue.items || []).reduce((acc, item) => {
        acc[item.priority] = (acc[item.priority] || 0) + 1;
        return acc;
      }, {})
    },
    annotations: {
      humanVerified,
      pending: annotations.filter((a) => a.verificationStatus === 'PENDING').length
    },
    readiness: {
      trainingReadiness,
      reason:
        trainingReadiness === 'READY_FOR_TRAINING'
          ? 'uniqueProducts >= 50 && humanVerified >= 100 && splitLeakage === 0'
          : [
              uniqueProducts < 50 ? `uniqueProducts=${uniqueProducts} < 50` : null,
              humanVerified < 100 ? `humanVerified=${humanVerified} < 100` : null,
              splitLeakage !== 0 ? `splitLeakage=${splitLeakage} != 0` : null
            ]
              .filter(Boolean)
              .join('; ') || 'unknown'
    },
    integrity: {
      splitLeakage,
      licenseBlockers
    },
    metadataProvenanceNote:
      'Views (viewSource=filename_inference) and categories (categorySource=directory|filename) are INFERRED metadata, not verified labels.'
  };

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(REPORTS_DIR, 'dataset-ingestion-hardening-v1.json'),
    JSON.stringify(report, null, 2)
  );

  const rows = [
    `# Dataset Ingestion Hardening Report v1`,
    ``,
    `> ${report.stepDisclaimer}`,
    ``,
    `## Readiness`,
    `- **Training Readiness**: ${report.readiness.trainingReadiness}`,
    `- **Reason**: ${report.readiness.reason}`,
    ``,
    `## Dataset`,
    `- **Unique Products**: ${report.dataset.uniqueProducts}`,
    `- **Total Images**: ${report.dataset.totalImages}`,
    `- **Views**: front=${report.dataset.views.front}, back=${report.dataset.views.back}, declaration=${report.dataset.views.declaration}, unknown=${report.dataset.views.unknown}`,
    `- **Category Distribution**: ${JSON.stringify(report.dataset.categoryDistribution)}`,
    `- **Unknown Category Count**: ${report.dataset.unknownCategoryCount}`,
    `- **Products With Declaration Views**: ${report.dataset.productsWithDeclarationViews}`,
    `- **Products Missing Declaration Views**: ${report.dataset.productsMissingDeclarationViews}`,
    `- **Avg Dimensions**: ${report.dataset.dimensions.averageWidth}x${report.dataset.dimensions.averageHeight}`,
    `- **Median Dimensions**: ${report.dataset.dimensions.medianWidth}x${report.dataset.dimensions.medianHeight}`,
    ``,
    `## Deduplication`,
    `- **Exact Duplicates**: ${report.deduplication.exactDuplicates}`,
    `- **Near Duplicates (flagged, retained)**: ${report.deduplication.nearDuplicates}`,
    `- **Unique Images**: ${report.deduplication.uniqueImages}`,
    `- **Malformed Images**: ${report.deduplication.malformed}`,
    ``,
    `## Verification Queue`,
    `- **Queue Size**: ${report.verificationQueue.count}`,
    `- **Priority Breakdown**: ${JSON.stringify(report.verificationQueue.priorityBreakdown)}`,
    ``,
    `## Annotations`,
    `- **Human Verified**: ${report.annotations.humanVerified}`,
    `- **Pending**: ${report.annotations.pending}`,
    ``,
    `## Integrity`,
    `- **Split Leakage**: ${report.integrity.splitLeakage}`,
    `- **License Blockers**: ${report.integrity.licenseBlockers}`,
    ``,
    `> Note: Views and categories are INFERRED metadata (provenance recorded), not verified labels.`
  ].join('\n');

  await fs.writeFile(path.join(REPORTS_DIR, 'dataset-ingestion-hardening-v1.md'), rows);

  console.log(`Hardening report written to ${REPORTS_DIR}`);
  console.log(`Training Readiness: ${report.readiness.trainingReadiness}`);
}

generateHardeningReport().catch(console.error);