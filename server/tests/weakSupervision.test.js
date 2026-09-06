import { generateDeclarationCandidates } from '../src/services/weakRoiCandidateService.js';
import { ExternalDatasetAdapter } from '../src/services/externalDatasetAdapter.js';

describe('Step 27: Weak Supervision & External Dataset Foundation', () => {
  describe('Weak ROI Candidate Service', () => {
    const metadata = { width: 1000, height: 1000 };

    test('Returns no_candidate when OCR results are empty', () => {
      const result = generateDeclarationCandidates([], metadata);
      expect(result.status).toBe('no_candidate');
      expect(result.provenance).toBe('weak_candidate');
      expect(result.candidates.length).toBe(0);
    });

    test('Returns no_candidate when no legal keywords are found', () => {
      const ocrResults = [
        { text: "Just some random text", confidence: 0.9, bbox: [[0,0], [10,0], [10,10], [0,10]] }
      ];
      const result = generateDeclarationCandidates(ocrResults, metadata);
      expect(result.status).toBe('no_candidate');
    });

    test('Generates candidate when legal keywords are present and pads correctly', () => {
      const ocrResults = [
        { text: "MRP 50", confidence: 0.9, bbox: [[100, 100], [200, 100], [200, 120], [100, 120]] },
        { text: "NET WT 500g", confidence: 0.8, bbox: [[100, 130], [250, 130], [250, 150], [100, 150]] }
      ];
      
      const result = generateDeclarationCandidates(ocrResults, metadata);
      expect(result.status).toBe('candidate_generated');
      expect(result.candidates.length).toBe(1);
      
      const candidate = result.candidates[0];
      expect(candidate.classId).toBe(2); // declaration_panel
      expect(candidate.sourceOcrDetectionIds).toEqual([0, 1]);
      
      // Expected logic:
      // minX = 100, maxX = 250
      // minY = 100, maxY = 150
      // padding = 5% of 1000 = 50
      // padded_minX = 50, padded_maxX = 300
      // padded_minY = 50, padded_maxY = 200
      // YOLO w = (300 - 50) / 1000 = 0.25
      // YOLO h = (200 - 50) / 1000 = 0.15
      // YOLO cx = 50 + (250 / 2) = 175 -> 0.175
      // YOLO cy = 50 + (150 / 2) = 125 -> 0.125
      
      expect(candidate.bbox[0]).toBeCloseTo(0.175);
      expect(candidate.bbox[1]).toBeCloseTo(0.125);
      expect(candidate.bbox[2]).toBeCloseTo(0.25);
      expect(candidate.bbox[3]).toBeCloseTo(0.15);
    });

    test('Clips bounding box to image dimensions', () => {
      // Put a box right at the edge so padding pushes it out of bounds
      const ocrResults = [
        { text: "MRP", confidence: 0.9, bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] }
      ];
      
      const result = generateDeclarationCandidates(ocrResults, metadata);
      const candidate = result.candidates[0];
      
      // The padded minX would be -50, but should be clamped to 0.
      // So minX = 0, maxX = 10 + 50 = 60.
      // w = 60 / 1000 = 0.06
      expect(candidate.bbox[2]).toBeCloseTo(0.06);
    });
  });

  describe('External Dataset Adapter', () => {
    test('Throws error for research-only licenses', () => {
      const adapter = new ExternalDatasetAdapter({
        datasetName: 'FineGrainOCR',
        license: { type: 'research_only' }
      });
      expect(() => adapter.validateLicense()).toThrow(/SIH/);
    });

    test('Rejects low confidence semantic mappings', () => {
      const adapter = new ExternalDatasetAdapter({
        datasetName: 'TestDataset',
        license: { type: 'permissive' },
        classMappings: {
          'text': { targetId: 2, confidence: 'low' },
          'package': { targetId: 0, confidence: 'high' }
        }
      });
      
      expect(adapter.mapClass('text')).toBeNull();
      expect(adapter.mapClass('package')).toBe(0);
    });
  });
});
