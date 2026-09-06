import { HybridOcrService } from '../src/services/hybridOcrService.js';

describe('Step 29: Hybrid OCR Service', () => {

  describe('Deduplication & Fusion Logic', () => {
    test('Returns full results if no ROI results', () => {
      const full = [{ text: "MRP", bbox: [[0,0], [10,0], [10,10], [0,10]] }];
      const fused = HybridOcrService.fuseOcrResults(full, []);
      expect(fused).toEqual(full);
    });

    test('Keeps ROI results entirely', () => {
      const roi = [{ text: "MRP", bbox: [[0,0], [10,0], [10,10], [0,10]], source: 'roi' }];
      const fused = HybridOcrService.fuseOcrResults([], roi);
      expect(fused).toEqual(roi);
    });

    test('Deduplicates exactly matching overlapping texts', () => {
      const full = [
        { text: "MRP Rs 50", bbox: [[100, 100], [200, 100], [200, 120], [100, 120]], source: 'full' }, // should be dup
        { text: "Brand Name", bbox: [[10, 10], [100, 10], [100, 50], [10, 50]], source: 'full' }       // keep
      ];
      
      const roi = [
        { text: "MRP Rs 50", bbox: [[102, 102], [202, 102], [202, 122], [102, 122]], source: 'roi' }
      ];

      const fused = HybridOcrService.fuseOcrResults(full, roi);
      
      // Expected: Brand Name (full) + MRP Rs 50 (roi)
      expect(fused.length).toBe(2);
      expect(fused.find(r => r.text === "Brand Name")).toBeDefined();
      const mrp = fused.find(r => r.text === "MRP Rs 50");
      expect(mrp.source).toBe('roi'); // The ROI one won
    });

    test('Keeps texts that overlap physically but differ significantly in content', () => {
      const full = [
        { text: "123456", bbox: [[100, 100], [200, 100], [200, 120], [100, 120]], source: 'full' } 
      ];
      
      const roi = [
        { text: "MRP Rs 50", bbox: [[102, 102], [202, 102], [202, 122], [102, 122]], source: 'roi' }
      ];

      const fused = HybridOcrService.fuseOcrResults(full, roi);
      
      // Since "123456" and "MRP Rs 50" have < 0.6 similarity, keep both
      expect(fused.length).toBe(2);
    });
  });

  describe('Text Similarity Helper', () => {
    test('Exact match', () => {
      expect(HybridOcrService._textSimilarity("MRP", "mrp")).toBe(1.0);
    });
    test('Substring match', () => {
      expect(HybridOcrService._textSimilarity("MRP RS 50", "mrp rs 50.")).toBe(1.0); // punctuation removed
      expect(HybridOcrService._textSimilarity("MRP RS 50", "mrp")).toBe(0.8);
    });
    test('No match', () => {
      expect(HybridOcrService._textSimilarity("MRP", "batch")).toBe(0);
    });
  });

});
