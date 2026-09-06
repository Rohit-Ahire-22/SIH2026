import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const SPLITS_MANIFEST_PATH = path.join(DATASET_DIR, 'splits', 'yolo', 'yolo-splits-manifest.json');
const YOLO_ROOT = path.join(DATASET_DIR, 'annotations', 'yolo');
const YOLO_IMAGES_SRC = path.join(YOLO_ROOT, 'images');
const YOLO_LABELS_SRC = path.join(YOLO_ROOT, 'labels');

async function exportYoloDataset() {
  console.log("Exporting YOLO Dataset structure...");
  
  let splitManifest;
  try {
    splitManifest = JSON.parse(await fs.readFile(SPLITS_MANIFEST_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Splits manifest not found. Run createYoloSplits.js first.`);
    process.exit(1);
  }

  const dirs = [
    path.join(YOLO_ROOT, 'images', 'train'),
    path.join(YOLO_ROOT, 'images', 'val'),
    path.join(YOLO_ROOT, 'labels', 'train'),
    path.join(YOLO_ROOT, 'labels', 'val'),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  async function processSet(images, setName) {
    let count = 0;
    for (const img of images) {
      if (img.status !== 'annotated' && img.status !== 'validated') {
        // Skip exporting images that are missing human annotations
        continue;
      }
      
      const labelFilename = img.filename.replace(path.extname(img.filename), '.txt');
      
      const srcImg = path.join(YOLO_IMAGES_SRC, img.filename);
      const srcLbl = path.join(YOLO_LABELS_SRC, labelFilename);
      
      const destImg = path.join(YOLO_ROOT, 'images', setName, img.filename);
      const destLbl = path.join(YOLO_ROOT, 'labels', setName, labelFilename);
      
      try {
        await fs.copyFile(srcImg, destImg);
        await fs.copyFile(srcLbl, destLbl);
        count++;
      } catch (err) {
        console.warn(`[WARNING] Failed to export ${img.filename}: ${err.message}`);
      }
    }
    return count;
  }

  const trainExported = await processSet(splitManifest.train, 'train');
  const valExported = await processSet(splitManifest.val, 'val');

  console.log(`Export Complete.`);
  console.log(`- Train exported: ${trainExported}`);
  console.log(`- Validation exported: ${valExported}`);
  
  if (trainExported === 0 && valExported === 0) {
    console.log(`\n[NOTE] 0 images exported because they are currently 'pending' human annotation. Use a tool like LabelImg to create bounding boxes, validate, and try exporting again!`);
  }
}

exportYoloDataset().catch(console.error);
