import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import crypto from 'crypto';
import { ImageDeduplicationService } from '../src/services/imageDeduplicationService.js';
import {
  makeTempDir,
  removeDir,
  writeFixtureImage,
  makeResizedCopy,
  gradientLR,
  texture
} from './helpers/imageTestUtils.js';

function requireSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('ImageDeduplicationService', () => {
  const tmp = {};
  let basePath;

  before(async () => {
    tmp.dir = await makeTempDir();
    basePath = path.join(tmp.dir, 'a.jpeg');
    await writeFixtureImage(basePath, 400, 300, gradientLR);
  });

  after(async () => {
    await removeDir(tmp.dir);
  });

  test('deterministic hash: same file always yields the same dHash', async () => {
    const h1 = await ImageDeduplicationService.dHashHexFromPath(basePath);
    const h2 = await ImageDeduplicationService.dHashHexFromPath(basePath);
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{16}$/);
  });

  test('identical image bytes are an exact duplicate via SHA-256', async () => {
    const copyPath = path.join(tmp.dir, 'copy.jpeg');
    const src = await import('fs/promises');
    await src.copyFile(basePath, copyPath);
    const buffer = await src.readFile(copyPath);
    const sha = requireSha256(buffer);
    const dHash = await ImageDeduplicationService.dHashHexFromPath(copyPath);
    const decision = ImageDeduplicationService.classifyDuplicate({
      sha256: sha,
      dHash,
      existingRecords: [{ imageId: 'a_front', hash: sha }]
    });
    assert.equal(decision.status, 'exact_duplicate');
    assert.equal(decision.duplicateOf, 'a_front');
  });

  test('resized/recompressed copy is a near-duplicate (small Hamming distance)', async () => {
    const resizedPath = path.join(tmp.dir, 'resized.jpeg');
    await makeResizedCopy(basePath, resizedPath, 200, 150);
    const src = await import('fs/promises');
    const orig = await src.readFile(basePath);
    const resized = await src.readFile(resizedPath);
    const origSha = requireSha256(orig);
    const resizedSha = requireSha256(resized);

    // Re-encoding changed the bytes.
    assert.notEqual(origSha, resizedSha);

    const origDHash = await ImageDeduplicationService.dHashHexFromBuffer(orig);
    const resizedDHash = await ImageDeduplicationService.dHashHexFromPath(resizedPath);
    const distance = ImageDeduplicationService.hammingDistance(origDHash, resizedDHash);
    assert.ok(distance <= 10, `expected near-duplicate distance <= 10, got ${distance}`);

    const decision = ImageDeduplicationService.classifyDuplicate({
      sha256: resizedSha,
      dHash: resizedDHash,
      existingRecords: [{ imageId: 'a_front', hash: origSha, dHash: origDHash }],
      nearDuplicateThreshold: 10,
      reviewThreshold: 18
    });
    assert.equal(decision.status, 'near_duplicate');
    assert.equal(decision.duplicateOf, 'a_front');
  });

  test('clearly different image is unique', async () => {
    const otherPath = path.join(tmp.dir, 'other.jpeg');
    await writeFixtureImage(otherPath, 400, 300, texture(97, 41));
    const src = await import('fs/promises');
    const orig = await src.readFile(basePath);
    const other = await src.readFile(otherPath);
    const origSha = requireSha256(orig);
    const otherDHash = await ImageDeduplicationService.dHashHexFromBuffer(other);
    const origDHash = await ImageDeduplicationService.dHashHexFromBuffer(orig);
    const distance = ImageDeduplicationService.hammingDistance(origDHash, otherDHash);
    assert.ok(distance > 18, `expected clear difference, got distance ${distance}`);
    const decision = ImageDeduplicationService.classifyDuplicate({
      sha256: requireSha256(other),
      dHash: otherDHash,
      existingRecords: [{ imageId: 'a_front', hash: origSha, dHash: origDHash }],
      nearDuplicateThreshold: 10,
      reviewThreshold: 18
    });
    assert.equal(decision.status, 'unique');
    assert.equal(decision.duplicateOf, null);
  });

  test('Hamming distance is computed in bits (not hex characters)', () => {
    assert.equal(ImageDeduplicationService.hammingDistance('0000000000000000', '0000000000000000'), 0);
    assert.equal(ImageDeduplicationService.hammingDistance('0000000000000000', 'ffffffffffffffff'), 64);
    // f0 nibble (1111) vs ff nibble (1111) = 0 bits; 0 nibble (0000) vs f (1111) = 4 bits per pair.
    assert.equal(ImageDeduplicationService.hammingDistance('f0f0f0f0f0f0f0f0', 'ffffffffffffffff'), 32);
  });

  test('threshold behavior is configurable (strict -> not rejected, loose -> flagged)', async () => {
    const src = await import('fs/promises');
    const basePathTexture = path.join(tmp.dir, 'tbase.jpeg');
    await writeFixtureImage(basePathTexture, 400, 300, texture(31, 7));
    const resizedPath = path.join(tmp.dir, 'resized3.jpeg');
    await makeResizedCopy(basePathTexture, resizedPath, 200, 150, 55);
    const orig = await src.readFile(basePathTexture);
    const resized = await src.readFile(resizedPath);
    const origSha = requireSha256(orig);
    const origDHash = await ImageDeduplicationService.dHashHexFromBuffer(orig);
    const resizedDHash = await ImageDeduplicationService.dHashHexFromBuffer(resized);
    const distance = ImageDeduplicationService.hammingDistance(origDHash, resizedDHash);
    assert.ok(distance > 0 && distance <= 30, `expected small-but-nonzero distance, got ${distance}`);

    const strict = ImageDeduplicationService.classifyDuplicate({
      sha256: requireSha256(resized),
      dHash: resizedDHash,
      existingRecords: [{ imageId: 't_front', hash: origSha, dHash: origDHash }],
      nearDuplicateThreshold: 0,
      reviewThreshold: 0
    });
    assert.equal(strict.status, 'unique');

    const loose = ImageDeduplicationService.classifyDuplicate({
      sha256: requireSha256(resized),
      dHash: resizedDHash,
      existingRecords: [{ imageId: 't_front', hash: origSha, dHash: origDHash }],
      nearDuplicateThreshold: 30,
      reviewThreshold: 40
    });
    assert.equal(loose.status, 'near_duplicate');
  });
});