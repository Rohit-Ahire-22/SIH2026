import { Jimp } from 'jimp';

const DHASH_BITS = 64;

const NIBBLE_BITS = new Array(16);
for (let i = 0; i < 16; i++) {
  NIBBLE_BITS[i] =
    ((i >> 3) & 1).toString() +
    ((i >> 2) & 1).toString() +
    ((i >> 1) & 1).toString() +
    (i & 1).toString();
}

/**
 * Perceptual (difference) hash + SHA-256 duplicate detection.
 *
 * Near-duplicate decisions are AUDITABLE, never silently destructive:
 * a near duplicate is flagged (duplicateStatus / duplicateReason / duplicateOf)
 * and the caller decides what to do with it. Front-vs-back images stay distinct
 * because classification preserves product/view identity.
 */
export class ImageDeduplicationService {
  /**
   * Decodes an image purely to measure its real dimensions and MIME type.
   * Returns null if the file is undeocdable (malformed).
   */
  static async decodeDimensions(filePath) {
    try {
      const image = await Jimp.read(filePath);
      return {
        width: image.bitmap.width,
        height: image.bitmap.height,
        mimeType: image.mime || null
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Deterministic dHash over a file.
   * @returns {Promise<string>} 16-char lowercase hex (64 bits)
   */
  static async dHashHexFromPath(filePath) {
    const image = await Jimp.read(filePath);
    return ImageDeduplicationService.bitsToHex(ImageDeduplicationService.computeDHashFromImage(image));
  }

  /**
   * Deterministic dHash over an in-memory buffer.
   * @returns {Promise<string>} 16-char lowercase hex (64 bits)
   */
  static async dHashHexFromBuffer(buffer) {
    const image = await Jimp.read(buffer);
    return ImageDeduplicationService.bitsToHex(ImageDeduplicationService.computeDHashFromImage(image));
  }

  /**
   * Difference hash: resize to 9x8, greyscale, compare each adjacent horizontal
   * pair of pixels. 8 rows x 8 comparisons = 64 bits. Fully deterministic.
   * @returns {string} binary string of exactly 64 characters
   */
  static computeDHashFromImage(image) {
    const small = image.clone().resize({ w: 9, h: 8 }).greyscale();
    const data = small.bitmap.data;
    const w = small.bitmap.width;
    const h = small.bitmap.height;
    let bits = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w - 1; x++) {
        const left = data[(y * w + x) * 4];
        const right = data[(y * w + x + 1) * 4];
        bits += left > right ? '1' : '0';
      }
    }
    return bits;
  }

  /**
   * Converts a 64-bit binary string to a compact 16-char hexadecimal string.
   */
  static bitsToHex(bits) {
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.substring(i, i + 4), 2).toString(16);
    }
    return hex;
  }

  /**
   * Hamming distance between two dHash hex strings (number of differing bits).
   * Throws if the hashes are not equal-length hex.
   */
  static hammingDistance(hexA, hexB) {
    if (typeof hexA !== 'string' || typeof hexB !== 'string' || hexA.length !== hexB.length) {
      throw new Error(`Cannot compare dHash values of unequal/empty length: "${hexA}" vs "${hexB}"`);
    }
    if (!/^[0-9a-f]+$/i.test(hexA) || !/^[0-9a-f]+$/i.test(hexB)) {
      throw new Error('dHash values must be hexadecimal strings');
    }
    let count = 0;
    for (let i = 0; i < hexA.length; i++) {
      const a = NIBBLE_BITS[parseInt(hexA[i], 16)];
      const b = NIBBLE_BITS[parseInt(hexB[i], 16)];
      for (let bit = 0; bit < 4; bit++) {
        if (a[bit] !== b[bit]) count++;
      }
    }
    return count;
  }

  /**
   * Classifies a new image against a set of already-registered images.
   *
   * Decision order (per spec): SHA-256 exact match wins; dHash is only consulted
   * for images that are NOT exact duplicates.
   *
   * @param {object}           options
   * @param {string}           options.sha256        SHA-256 hex of the new image
   * @param {string}           options.dHash         dHash hex of the new image
   * @param {Array<object>}    options.existingRecords [{imageId, hash|sha256, dHash}]
   * @param {number}           [options.nearDuplicateThreshold=10] bits (of 64) -> near_duplicate
   * @param {number}           [options.reviewThreshold=18]        bits -> review (human flag)
   * @returns {object} {status, reason, duplicateOf, distanceToNearest}
   */
  static classifyDuplicate({
    sha256,
    dHash,
    existingRecords,
    nearDuplicateThreshold = 10,
    reviewThreshold = 18
  }) {
    if (!existingRecords || existingRecords.length === 0) {
      return {
        status: 'unique',
        reason: 'first registered image (no comparison candidates)',
        duplicateOf: null,
        distanceToNearest: null
      };
    }

    // 1. Exact duplicate: SHA-256 first, dHash is NOT consulted.
    const exact = existingRecords.find(
      (r) => r.sha256 === sha256 || r.hash === sha256
    );
    if (exact) {
      return {
        status: 'exact_duplicate',
        reason: `SHA-256 matches already-registered image ${exact.imageId || exact.relativePath}`,
        duplicateOf: exact.imageId || null,
        distanceToNearest: 0
      };
    }

    // 2. Perceptual near-duplicate: dHash only for non-exact-duplicates.
    let best = null;
    for (const r of existingRecords) {
      if (!r.dHash) continue;
      const dist = ImageDeduplicationService.hammingDistance(dHash, r.dHash);
      if (best === null || dist < best.distance) {
        best = { imageId: r.imageId || r.relativePath, distance: dist };
      }
    }

    if (best === null) {
      return {
        status: 'unique',
        reason: 'no perceptual fingerprint available for comparison',
        duplicateOf: null,
        distanceToNearest: null
      };
    }

    if (best.distance <= nearDuplicateThreshold) {
      return {
        status: 'near_duplicate',
        reason: `dHash differs by ${best.distance} bits from ${best.imageId} (near-duplicate threshold ${nearDuplicateThreshold})`,
        duplicateOf: best.imageId,
        distanceToNearest: best.distance
      };
    }

    if (best.distance <= reviewThreshold) {
      return {
        status: 'review',
        reason: `dHash differs by ${best.distance} bits from ${best.imageId} (review threshold ${reviewThreshold})`,
        duplicateOf: best.imageId,
        distanceToNearest: best.distance
      };
    }

    return {
      status: 'unique',
      reason: `dHash differs by ${best.distance} bits from nearest candidate ${best.imageId}`,
      duplicateOf: null,
      distanceToNearest: best.distance
    };
  }
}