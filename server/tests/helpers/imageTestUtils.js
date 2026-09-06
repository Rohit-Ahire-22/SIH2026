import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Jimp } from 'jimp';

export async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sih-test-'));
}

export async function removeDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Writes a JPEG/PNG with a deterministic per-pixel color function.
 * @param {string} filePath
 * @param {number} width
 * @param {number} height
 * @param {(x:number,y:number)=>[number,number,number]} colorFn RGB 0..255
 * @param {'image/jpeg'|'image/png'} [mime]
 * @returns {Promise<Buffer>} the exact bytes written
 */
export async function writeFixtureImage(filePath, width, height, colorFn, mime = 'image/jpeg') {
  const img = new Jimp({ width, height, color: 0x000000ff });
  const data = img.bitmap.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colorFn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r & 0xff;
      data[i + 1] = g & 0xff;
      data[i + 2] = b & 0xff;
      data[i + 3] = 255;
    }
  }
  const buffer = await img.getBuffer(mime, mime === 'image/jpeg' ? { quality: 85 } : undefined);
  await fs.writeFile(filePath, buffer);
  return buffer;
}

export const gradientLR = (x, y, width) => {
  const t = x / Math.max(1, width - 1);
  const v = Math.round(t * 255);
  return [v, v, v];
};

export const gradientRL = (x, y, width) => {
  const t = 1 - x / Math.max(1, width - 1);
  const v = Math.round(t * 255);
  return [v, v, v];
};

export const checker = (x, y) => {
  const block = 32;
  const on = Math.floor(x / block) % 2 === Math.floor(y / block) % 2;
  const v = on ? 220 : 30;
  return [v, v, v];
};

export const texture = (a, b) => (x, y) => {
  const v = (x * a + y * b) % 256;
  return [v, v, v];
};

/**
 * Resized + recompressed copy (used to build genuine near-duplicates).
 */
export async function makeResizedCopy(srcPath, dstPath, width, height, quality = 55) {
  const img = await Jimp.read(srcPath);
  const resized = img.clone().resize({ w: width, h: height });
  const buffer = await resized.getBuffer('image/jpeg', { quality });
  await fs.writeFile(dstPath, buffer);
  return buffer;
}