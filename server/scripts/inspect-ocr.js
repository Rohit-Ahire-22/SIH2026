import fs from 'fs/promises';
import path from 'path';
import { HybridOcrService } from '../src/services/hybridOcrService.js';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });

const MANIFEST_FILE = path.join(process.cwd(), '..', 'dataset', 'manifests', 'proprietary-dataset-manifest.json');

async function inspectOcr(productId, view) {
  const manifestData = JSON.parse(await fs.readFile(MANIFEST_FILE, 'utf-8'));
  const image = manifestData.images.find(img => img.productId === productId && img.view === view);
  if (!image) {
    console.log(`Image not found: ${productId} - ${view}`);
    return;
  }
  
  // Need to read the file as buffer or start local server
  // Actually, HybridOcrService.runHybridOcr takes a URL or absolute path?
  // Let's see: `src/services/hybridOcrService.js` line 44 uses `fetch(imageUrl)`
  // So we need the local server. Let's just use the absolute file path, Wait, does it support local file paths?
  // HybridOcrService fetches the image, so let's start a quick express server.
}

import express from 'express';
const app = express();
app.use('/dataset', express.static(path.join(process.cwd(), '..', 'dataset')));
const server = app.listen(5002, async () => {
  console.log('Test server started on 5002');
  try {
    const imageUrl = 'http://127.0.0.1:5002/dataset/raw/proprietary/product_001/back.jpeg';
    const res = await HybridOcrService.runHybridOcr(imageUrl, 'image/jpeg');
    console.log('--- PRODUCT 001 BACK OCR ---');
    console.log(JSON.stringify(res.results.map(r => r.text), null, 2));

    const imageUrl3 = 'http://127.0.0.1:5002/dataset/raw/proprietary/product_003/back.jpeg';
    const res3 = await HybridOcrService.runHybridOcr(imageUrl3, 'image/jpeg');
    console.log('--- PRODUCT 003 BACK OCR ---');
    console.log(JSON.stringify(res3.results.map(r => r.text), null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    server.close();
  }
});
