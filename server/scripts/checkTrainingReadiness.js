import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const YOLO_MANIFEST_PATH = path.join(DATASET_DIR, 'reports', 'yolo', 'annotation-manifest.json');
const REPORT_DIR = path.join(DATASET_DIR, 'reports', 'yolo');

// Gate thresholds
const READY_EXPERIMENT_MIN_PRODUCTS = 50;
const READY_EXPERIMENT_MIN_ANNOTATIONS = 100;
const READY_MODEL_MIN_PRODUCTS = 200;
const READY_MODEL_MIN_ANNOTATIONS = 1000;

async function checkTrainingReadiness() {
  console.log("Checking YOLO Training Readiness...");

  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(YOLO_MANIFEST_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Manifest not found. Run createYoloAnnotationManifest.js first.`);
    process.exit(1);
  }

  const products = new Set(manifest.images.map(img => img.productId));
  const productCount = products.size;
  const imageCount = manifest.images.length;

  let humanVerifiedAnnotations = 0;
  for (const img of manifest.images) {
    if (img.status === 'annotated' || img.status === 'validated') {
      humanVerifiedAnnotations++;
    }
  }

  let weakCandidates = 0;
  try {
    const weakDir = path.join(REPORT_DIR, 'weak-candidates');
    const files = await fs.readdir(weakDir);
    weakCandidates = files.filter(f => f.endsWith('.txt')).length;
  } catch (err) {
    // Directory might not exist yet
  }

  let readinessStatus = 'NOT_READY';
  const reasons = [];

  if (humanVerifiedAnnotations < READY_EXPERIMENT_MIN_ANNOTATIONS) {
    reasons.push(`Insufficient verified annotations (${humanVerifiedAnnotations}/${READY_EXPERIMENT_MIN_ANNOTATIONS} required for experiment).`);
  }
  if (productCount < READY_EXPERIMENT_MIN_PRODUCTS) {
    reasons.push(`Insufficient product diversity (${productCount}/${READY_EXPERIMENT_MIN_PRODUCTS} required for experiment).`);
  }

  if (reasons.length === 0) {
    readinessStatus = 'READY_FOR_EXPERIMENT';
    
    if (humanVerifiedAnnotations >= READY_MODEL_MIN_ANNOTATIONS && productCount >= READY_MODEL_MIN_PRODUCTS) {
      readinessStatus = 'READY_FOR_SIH_MODEL';
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    status: readinessStatus,
    metrics: {
      uniqueProducts: productCount,
      totalImages: imageCount,
      humanVerifiedAnnotations,
      weakCandidates
    },
    blockers: reasons
  };

  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(path.join(REPORT_DIR, 'training-readiness.json'), JSON.stringify(report, null, 2));

  console.log(`\n=== TRAINING READINESS GATE ===`);
  console.log(`Status: ${readinessStatus}`);
  console.log(`Unique Products: ${productCount}`);
  console.log(`Images: ${imageCount}`);
  console.log(`Human Verified Annotations: ${humanVerifiedAnnotations}`);
  console.log(`Weak Candidates: ${weakCandidates}`);
  
  if (reasons.length > 0) {
    console.log(`\nBlockers:`);
    reasons.forEach(r => console.log(`- ${r}`));
  }
  
  console.log(`\nReport generated at ${path.join(REPORT_DIR, 'training-readiness.json')}`);
}

checkTrainingReadiness().catch(console.error);
