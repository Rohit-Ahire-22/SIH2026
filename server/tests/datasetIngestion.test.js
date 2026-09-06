import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { Jimp } from 'jimp';
import { LocalImageIngestionService } from '../src/services/localImageIngestionService.js';
import { VerificationQueueService } from '../src/services/verificationQueueService.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.join(__dirname, '.temp_dataset');

async function createTestImage(filePath, color, width=100, height=100) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // Create a solid color image
  const img = new Jimp({ width, height, color });
  await img.write(filePath);
}

describe('Real File-Level Ingestion Tests', () => {
  let manifestPath;
  let rawRoot;
  let service;

  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    rawRoot = path.join(TEST_DIR, 'raw', 'proprietary');
    manifestPath = path.join(TEST_DIR, 'config', 'image-manifest.json');
    
    // Create test fixtures
    // A: Valid image
    await createTestImage(path.join(rawRoot, 'product_001', 'front.jpg'), 0xFF0000FF);
    // B: Exact duplicate of A
    await createTestImage(path.join(rawRoot, 'product_001', 'front_duplicate.jpg'), 0xFF0000FF);
    // C: Near duplicate of A (slightly different size/color) -> we'll simulate by resizing slightly
    await createTestImage(path.join(rawRoot, 'product_001', 'near_dup.jpg'), 0xFF0000FF, 102, 102);
    // D: Different image
    await createTestImage(path.join(rawRoot, 'product_001', 'back.jpg'), 0x00FF00FF);
    
    // E, F: Product grouping & Declaration view
    await createTestImage(path.join(rawRoot, 'product_002', 'declaration.jpg'), 0x0000FFFF);
    await createTestImage(path.join(rawRoot, 'product_002', 'front.jpg'), 0xFFFF00FF);

    // G: Category inference (directory name)
    await createTestImage(path.join(rawRoot, 'spice_001', 'front.jpg'), 0xFF00FFFF);

    // H: Unknown view
    await createTestImage(path.join(rawRoot, 'product_003', 'randomname.jpg'), 0x00FFFFFF);

    // Write fake registry/annotations for queue testing
    await fs.mkdir(path.join(TEST_DIR, 'config'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'config', 'source-registry.json'), JSON.stringify({
      registry: [{ license: 'proprietary', approvalStatus: 'APPROVED' }]
    }));
    await fs.mkdir(path.join(TEST_DIR, 'annotations'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'annotations', 'master-annotations.json'), JSON.stringify([
      { imageId: 'product_002_declaration', verificationStatus: 'PENDING', classId: 2, className: 'declaration_panel' }
    ]));

    service = new LocalImageIngestionService({
      rawRoot,
      manifestPath,
      nearDuplicateThreshold: 10,
      reviewThreshold: 18,
      categoryOverrides: {}
    });
  });

  after(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  test('Test Ingestion Pipeline (A, B, C, D, E, F, G, H)', async () => {
    // includeUnregisteredProducts = true so it picks up our new test folders
    const summary = await service.ingest({ includeUnregisteredProducts: true });
    
    // We expect 4 products (product_001, product_002, product_003, spice_001)
    assert.equal(summary.uniqueProducts, 4, 'Should identify 4 unique products');
    
    // product_001 has 4 files. 1 is exact dup. 1 is near dup. 2 are unique.
    // product_002 has 2 files. Both unique.
    // product_003 has 1 file. Unique.
    // spice_001 has 1 file. Unique.
    // Total raw files: 8
    assert.equal(summary.rawFilesScanned, 8);
    
    const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestRaw);

    const images = manifest.images;
    
    // A: Valid image
    const p1front = images.find(i => i.relativePath === 'product_001/front.jpg');
    assert.ok(p1front);
    assert.equal(p1front.width, 100);
    assert.equal(p1front.height, 100);
    assert.ok(p1front.hash);
    assert.ok(p1front.dHash);

    // B: Exact duplicate
    // Exact duplicates are logged but NOT added to manifest.images
    const p1dup = images.find(i => i.relativePath === 'product_001/front_duplicate.jpg');
    assert.ok(!p1dup, 'Exact duplicate should not be in manifest');
    assert.equal(summary.exactDuplicates, 1, 'Should log 1 exact duplicate');

    // C: Near duplicate
    const p1near = images.find(i => i.relativePath === 'product_001/near_dup.jpg');
    assert.ok(p1near, 'Near duplicate should be retained in manifest');
    // It might be 'near_duplicate' or 'review' or 'exact' depending on how Jimp resizes
    assert.ok(p1near.duplicateStatus !== 'unique', 'Near duplicate should be flagged');

    // D: Different image (back)
    const p1back = images.find(i => i.relativePath === 'product_001/back.jpg');
    assert.equal(p1back.view, 'back');

    // E: Product grouping
    assert.equal(p1front.productId, 'product_001');
    assert.equal(p1back.productId, 'product_001');

    // F: Declaration view
    const p2dec = images.find(i => i.relativePath === 'product_002/declaration.jpg');
    assert.equal(p2dec.view, 'declaration', 'Should infer declaration view');
    
    // G: Category inference
    const spice = images.find(i => i.relativePath === 'spice_001/front.jpg');
    assert.equal(spice.category, 'spice', 'Should infer category spice from directory name');

    // H: Unknown view
    const p3rand = images.find(i => i.relativePath === 'product_003/randomname.jpg');
    assert.equal(p3rand.view, 'unknown', 'Should infer unknown view');

    // Deterministic split (Product leakage check)
    assert.equal(p1front.split, p1back.split, 'Front and back must be in the same split');
  });

  test('Test Verification Queue Generation (I)', async () => {
    const queueResult = await VerificationQueueService.buildQueue({
      manifestPath,
      annotationsPath: path.join(TEST_DIR, 'annotations', 'master-annotations.json'),
      sourceRegistryPath: path.join(TEST_DIR, 'config', 'source-registry.json')
    });

    const items = queueResult.items;
    
    // Priorities:
    // 1: declaration -> product_002/declaration.jpg should be priority 1
    const p2dec = items.find(i => i.filePath === 'product_002/declaration.jpg');
    assert.equal(p2dec.priority, 1);

    // 2: back -> product_001/back.jpg
    const p1back = items.find(i => i.filePath === 'product_001/back.jpg');
    assert.equal(p1back.priority, 2);

    // Exact duplicates are not in the manifest images array, so excluded count from manifest is 0
    assert.equal(queueResult.excluded.exactDuplicates, 0);
  });
});
