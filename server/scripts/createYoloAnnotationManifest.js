import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const SOURCE_MANIFEST = path.join(DATASET_DIR, 'manifests', 'proprietary-dataset-manifest.json');
const YOLO_MANIFEST_DIR = path.join(DATASET_DIR, 'reports', 'yolo');
const YOLO_MANIFEST_PATH = path.join(YOLO_MANIFEST_DIR, 'annotation-manifest.json');
const YOLO_IMAGES_DIR = path.join(DATASET_DIR, 'annotations', 'yolo', 'images');
const YOLO_LABELS_DIR = path.join(DATASET_DIR, 'annotations', 'yolo', 'labels');

async function createManifest() {
  console.log("Discovering proprietary dataset...");
  let sourceData;
  try {
    sourceData = JSON.parse(await fs.readFile(SOURCE_MANIFEST, 'utf-8'));
  } catch (err) {
    console.error("Failed to load source manifest:", err.message);
    process.exit(1);
  }

  const { products, images } = sourceData;
  
  await fs.mkdir(YOLO_MANIFEST_DIR, { recursive: true });
  await fs.mkdir(YOLO_IMAGES_DIR, { recursive: true });
  await fs.mkdir(YOLO_LABELS_DIR, { recursive: true });

  const annotationManifest = {
    datasetVersion: "yolo-annotation-v1",
    sourceDatasetVersion: sourceData.datasetVersion,
    schemaVersion: "1.0",
    classSchemaVersion: "1.0",
    createdAt: new Date().toISOString(),
    stats: {
      productCount: products.length,
      imageCount: images.length,
      frontCount: 0,
      backCount: 0,
      pendingCount: 0,
      annotatedCount: 0,
      validatedCount: 0
    },
    images: []
  };

  for (const img of images) {
    if (img.view === 'front') annotationManifest.stats.frontCount++;
    if (img.view === 'back') annotationManifest.stats.backCount++;
    
    // Create the standard filename e.g., product_001_front.jpg
    const ext = path.extname(img.relativePath);
    const standardizedName = `${img.productId}_${img.view}${ext}`;
    const destImagePath = path.join(YOLO_IMAGES_DIR, standardizedName);
    const sourceImagePath = path.join(DATASET_DIR, '..', img.relativePath);
    
    // Copy image to the annotation directory to isolate YOLO dataset from raw
    try {
      await fs.copyFile(sourceImagePath, destImagePath);
    } catch (e) {
      console.warn(`[WARN] Could not copy ${sourceImagePath} to ${destImagePath}: ${e.message}`);
    }

    annotationManifest.images.push({
      imageId: img.imageId,
      productId: img.productId,
      view: img.view,
      sha256: img.sha256,
      filename: standardizedName,
      sourcePath: img.relativePath,
      status: "pending",
      annotationVersion: null,
      trainingEligible: false
    });
    
    annotationManifest.stats.pendingCount++;
  }

  await fs.writeFile(YOLO_MANIFEST_PATH, JSON.stringify(annotationManifest, null, 2));
  console.log(`Successfully generated YOLO annotation manifest at ${YOLO_MANIFEST_PATH}`);
  console.log(`All ${annotationManifest.stats.pendingCount} images marked as pending.`);
}

createManifest().catch(console.error);
