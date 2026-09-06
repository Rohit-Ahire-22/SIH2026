import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { DatasetIngestionService } from '../src/services/datasetIngestionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROPRIETARY_DIR = path.resolve(__dirname, '../../dataset/raw/proprietary');
const MANIFEST_PATH = path.resolve(__dirname, '../../dataset/manifests/proprietary-dataset-manifest.json');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

async function ingestDataset() {
  console.log(`Starting ingestion from ${PROPRIETARY_DIR}...`);
  
  let products = [];
  let images = [];
  const hashSet = new Set();
  
  let exactDuplicates = 0;
  let invalidProducts = 0;
  
  // Discover product folders
  const entries = await fs.readdir(PROPRIETARY_DIR, { withFileTypes: true });
  const productFolders = entries.filter(e => e.isDirectory());
  
  for (const folder of productFolders) {
    const productId = folder.name;
    const productPath = path.join(PROPRIETARY_DIR, productId);
    const fileEntries = await fs.readdir(productPath, { withFileTypes: true });
    
    const productViews = [];
    let frontImage = null;
    let backImage = null;
    
    for (const file of fileEntries) {
      if (!file.isFile()) continue;
      const ext = path.extname(file.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        console.warn(`[WARNING] Unsupported file type in ${productId}: ${file.name}`);
        continue;
      }
      
      const basename = path.basename(file.name, ext).toLowerCase();
      const viewType = basename === 'front' ? 'front' : (basename === 'back' ? 'back' : basename);
      
      const imagePath = path.join(productPath, file.name);
      const sha256 = await DatasetIngestionService.computeFileHash(imagePath);
      
      if (hashSet.has(sha256)) {
        console.warn(`[WARNING] Exact duplicate detected: ${imagePath}`);
        exactDuplicates++;
        continue; // Skip appending exact duplicates to manifest
      }
      hashSet.add(sha256);
      
      // Ingest it as a candidate
      const candidate = await DatasetIngestionService.ingestNewTrainingCandidate(imagePath, {
        productId,
        view: viewType,
        sourceType: 'user_captured',
        ownership: 'project_owned'
      });
      
      // Make it relative for the manifest
      candidate.relativePath = path.relative(path.resolve(__dirname, '../../'), imagePath).replace(/\\/g, '/');
      delete candidate.originalPath; // don't store absolute paths
      
      images.push(candidate);
      productViews.push(viewType);
      
      if (viewType === 'front') frontImage = candidate.imageId;
      if (viewType === 'back') backImage = candidate.imageId;
      
      if (viewType !== 'front' && viewType !== 'back') {
        console.warn(`[WARNING] Unexpected view name in ${productId}: ${viewType}`);
      }
    }
    
    const status = (frontImage && backImage) ? 'complete' : 'incomplete';
    if (status === 'incomplete') invalidProducts++;
    
    products.push({
      productId,
      imageCount: productViews.length,
      views: productViews,
      frontImage,
      backImage,
      status
    });
  }
  
  const manifest = {
    schemaVersion: "1.0",
    datasetVersion: "dataset-v1",
    generatedAt: new Date().toISOString(),
    sourceRoot: "dataset/raw/proprietary",
    sourceType: "user_captured",
    ownership: "project_owned",
    productCount: products.length,
    imageCount: images.length,
    validationSummary: {
      exactDuplicates,
      invalidProducts,
      warnings: exactDuplicates > 0 || invalidProducts > 0
    },
    products,
    images
  };
  
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Ingestion complete! Manifest saved to ${MANIFEST_PATH}`);
  console.log(`Discovered: ${products.length} products, ${images.length} images.`);
}

ingestDataset().catch(err => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
