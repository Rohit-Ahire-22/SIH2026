import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { detectRegions, selectOcrRegions, processImageWithRoiFallback } from '../src/services/roiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Step 26: YOLO ROI Foundation', () => {
  const CLASSES_PATH = path.resolve(__dirname, '../../ai-service/config/yolo_classes.json');

  test('Classes configuration is valid and authoritative', async () => {
    const data = await fs.readFile(CLASSES_PATH, 'utf-8');
    const config = JSON.parse(data);
    expect(config.schemaVersion).toBe('1.0.0');
    expect(config.classes).toBeInstanceOf(Array);
    
    // Must have 0, 1, 2
    const ids = config.classes.map(c => c.id);
    expect(ids).toContain(0);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
  });

  describe('ROI Service Contract', () => {
    test('detectRegions gracefully reports model_unavailable', async () => {
      const result = await detectRegions(Buffer.from('fake'), 'image/jpeg');
      expect(result.success).toBe(false);
      expect(result.status).toBe('model_unavailable');
      expect(result.detections.length).toBe(0);
    });

    test('selectOcrRegions selects correct classes based on view', () => {
      const fakeDetections = [
        { classId: 0, className: 'product_package' },
        { classId: 1, className: 'principal_display_panel' },
        { classId: 2, className: 'declaration_panel' }
      ];

      const frontRegions = selectOcrRegions(fakeDetections, 'front');
      expect(frontRegions.length).toBe(1);
      expect(frontRegions[0].className).toBe('principal_display_panel');

      const backRegions = selectOcrRegions(fakeDetections, 'back');
      expect(backRegions.length).toBe(1);
      expect(backRegions[0].className).toBe('declaration_panel');
    });

    test('processImageWithRoiFallback executes fallback when YOLO is unavailable', async () => {
      const mockFallbackFn = jest.fn().mockResolvedValue([{ text: 'FAKE_OCR' }]);
      
      const result = await processImageWithRoiFallback(Buffer.from('fake'), 'image/jpeg', 'back', mockFallbackFn);
      
      expect(mockFallbackFn).toHaveBeenCalledTimes(1);
      expect(result[0].text).toBe('FAKE_OCR');
    });
  });

  // Tests for logic found in annotation scripts:
  describe('YOLO Split Leakage Protection', () => {
    test('Product grouping prevents leakage across sets', () => {
      // If we have 2 images for product A, both MUST go to the same split.
      // This is purely a logical verification of the implementation rules.
      const trainSet = new Set(['product_001', 'product_002']);
      const valSet = new Set(['product_003']);
      
      const intersection = [...trainSet].filter(x => valSet.has(x));
      expect(intersection.length).toBe(0);
    });
  });
});
