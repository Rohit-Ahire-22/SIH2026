import { RoiCropService } from '../src/services/roiCropService.js';
import { Jimp } from 'jimp';

describe('Step 29: ROI Crop Service', () => {
  let testImageBuffer;

  beforeAll(async () => {
    // Create a dummy 100x100 white image buffer
    const img = new Jimp({ width: 100, height: 100, color: 0xffffffff });
    testImageBuffer = await img.getBuffer('image/png');
  });

  test('Rejects invalid buffers', async () => {
    await expect(RoiCropService.cropRegion(null, 'image/png', [0.5, 0.5, 0.5, 0.5])).rejects.toThrow(/Invalid image buffer/);
  });

  test('Rejects invalid bounding box format', async () => {
    await expect(RoiCropService.cropRegion(testImageBuffer, 'image/png', [0.5, 0.5])).rejects.toThrow(/Invalid YOLO bounding box/);
  });

  test('Rejects zero dimensions', async () => {
    await expect(RoiCropService.cropRegion(testImageBuffer, 'image/png', [0.5, 0.5, 0, 0])).rejects.toThrow(/greater than zero/);
  });

  test('Crops correctly to normalized coordinates', async () => {
    // crop center at 50,50 with w 50, h 50
    // so x1=25, y1=25, x2=75, y2=75
    const result = await RoiCropService.cropRegion(testImageBuffer, 'image/png', [0.5, 0.5, 0.5, 0.5]);
    
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.bboxOriginal).toEqual({ x1: 25, y1: 25, x2: 75, y2: 75 });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  test('Clips gracefully at image boundaries', async () => {
    // Center at 0,0 with w 50, h 50.
    // Original calculation: x1=-25, y1=-25, x2=25, y2=25
    // Clipped to: x1=0, y1=0, x2=25, y2=25
    // Width/Height = 25
    const result = await RoiCropService.cropRegion(testImageBuffer, 'image/png', [0, 0, 0.5, 0.5]);
    
    expect(result.width).toBe(25);
    expect(result.height).toBe(25);
    expect(result.bboxOriginal).toEqual({ x1: 0, y1: 0, x2: 25, y2: 25 });
  });

  test('Throws if clipped out of bounds completely', async () => {
    // Center off screen
    await expect(RoiCropService.cropRegion(testImageBuffer, 'image/png', [2.0, 2.0, 0.5, 0.5])).rejects.toThrow(/zero dimensions after boundary clipping/);
  });
});
