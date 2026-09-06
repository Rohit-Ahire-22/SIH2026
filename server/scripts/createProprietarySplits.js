import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.resolve(__dirname, '../../dataset/manifests/proprietary-dataset-manifest.json');
const SPLITS_PATH = path.resolve(__dirname, '../../dataset/splits/proprietary-dataset-split.json');

async function createSplits() {
  console.log("Loading dataset manifest...");
  const manifestData = await fs.readFile(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(manifestData);
  
  const productCount = manifest.products.length;
  console.log(`Found ${productCount} products.`);
  
  const splits = {
    datasetVersion: manifest.datasetVersion,
    splitStrategy: "product_level",
    generatedAt: new Date().toISOString(),
    baseline_integration_dataset: {
      products: [],
      images: []
    },
    train: {
      products: [],
      images: []
    },
    validation: {
      products: [],
      images: []
    },
    test: {
      products: [],
      images: []
    }
  };

  // For the current baseline of ~10 products, everything goes into baseline_integration_dataset.
  // We do not claim statistically meaningful train/val/test splits yet.
  
  for (const product of manifest.products) {
    // Determine target split (for now everything is baseline)
    const targetSplit = 'baseline_integration_dataset';
    
    splits[targetSplit].products.push(product.productId);
    
    // Find all images for this product and add to the same split
    const productImages = manifest.images.filter(img => img.productId === product.productId);
    for (const img of productImages) {
      splits[targetSplit].images.push(img.imageId);
    }
  }
  
  await fs.mkdir(path.dirname(SPLITS_PATH), { recursive: true });
  await fs.writeFile(SPLITS_PATH, JSON.stringify(splits, null, 2));
  
  console.log(`Splits generated and saved to ${SPLITS_PATH}`);
  console.log(`Baseline Split: ${splits.baseline_integration_dataset.products.length} products, ${splits.baseline_integration_dataset.images.length} images.`);
}

createSplits().catch(err => {
  console.error("Splitting failed:", err);
  process.exit(1);
});
