import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const WEAK_CANDIDATES_DIR = path.join(DATASET_DIR, 'reports', 'yolo', 'weak-candidates');
const ANNOTATIONS_DIR = path.join(DATASET_DIR, 'annotations');
const MASTER_ANNOTATIONS_PATH = path.join(ANNOTATIONS_DIR, 'master-annotations.json');
const CLASSES_CONFIG = path.resolve(__dirname, '../../ai-service/config/yolo_classes.json');

async function importWeakAnnotations() {
  console.log("Importing Weak Annotations...");

  let classConfig;
  try {
    classConfig = JSON.parse(await fs.readFile(CLASSES_CONFIG, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Failed to load classes config: ${err.message}`);
    process.exit(1);
  }

  const classMap = {};
  for (const c of classConfig.classes) {
    classMap[c.id] = c.name;
  }

  let masterAnnotations = [];
  try {
    const data = await fs.readFile(MASTER_ANNOTATIONS_PATH, 'utf-8');
    masterAnnotations = JSON.parse(data);
  } catch (err) {
    // File might not exist yet, start fresh
  }

  // Create a Set of existing identifiers to ensure idempotency
  // We identify a weak candidate uniquely by imageId (derived from filename) and classId + bbox
  const existingSet = new Set(masterAnnotations.map(a => 
    `${a.imageId}_${a.classId}_${a.boundingBox.xCenter.toFixed(4)}_${a.boundingBox.yCenter.toFixed(4)}`
  ));

  let files;
  try {
    files = await fs.readdir(WEAK_CANDIDATES_DIR);
  } catch (err) {
    console.error(`[ERROR] Could not read weak candidates directory: ${err.message}`);
    process.exit(1);
  }

  let importedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (!file.endsWith('.txt')) continue;

    const baseName = file.replace('.txt', '');
    // e.g., product_001_back
    const [productId, view] = baseName.match(/(product_\d+)_(front|back)/).slice(1, 3);
    
    // In our simplified system, we derive imageId from the basename for simplicity
    const imageId = baseName;

    const content = await fs.readFile(path.join(WEAK_CANDIDATES_DIR, file), 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length !== 5) continue;

      const classId = parseInt(parts[0], 10);
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const w = parseFloat(parts[3]);
      const h = parseFloat(parts[4]);

      const dedupeKey = `${imageId}_${classId}_${x.toFixed(4)}_${y.toFixed(4)}`;
      if (existingSet.has(dedupeKey)) {
        skippedCount++;
        continue;
      }

      const annotation = {
        annotationId: crypto.randomUUID(),
        productId,
        imageId,
        source: "ocr_spatial_heuristic",
        sourceLicense: "proprietary",
        classId,
        className: classMap[classId] || "unknown",
        boundingBox: {
          xCenter: x,
          yCenter: y,
          width: w,
          height: h
        },
        provenance: "weak_candidate",
        verificationStatus: "PENDING",
        reviewerId: null,
        verifiedAt: null,
        originalBoundingBox: null,
        originalClassId: null,
        reviewNotes: null,
        trainingEligible: false
      };

      masterAnnotations.push(annotation);
      existingSet.add(dedupeKey);
      importedCount++;
    }
  }

  await fs.mkdir(ANNOTATIONS_DIR, { recursive: true });
  await fs.writeFile(MASTER_ANNOTATIONS_PATH, JSON.stringify(masterAnnotations, null, 2));

  console.log(`Imported: ${importedCount}`);
  console.log(`Skipped (Duplicate): ${skippedCount}`);
  console.log(`Total Annotations in Master: ${masterAnnotations.length}`);
}

importWeakAnnotations().catch(console.error);
