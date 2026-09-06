import { AnnotationVerificationService } from '../src/services/annotationVerificationService.js';
import { AugmentationService } from '../src/services/augmentationService.js';
import { TrainingReadinessService } from '../src/services/trainingReadinessService.js';

describe('Step 28: Dataset Scaling & Verification Logic', () => {

  describe('Annotation Verification Service', () => {
    const mockWeakCandidate = {
      classId: 2,
      className: 'declaration_panel',
      bbox: [0.5, 0.5, 0.2, 0.2],
      provenance: 'weak_candidate'
    };

    test('Rejects attempting to verify non-weak candidates', () => {
      expect(() => {
        AnnotationVerificationService.processVerification({ provenance: 'human_verified' }, { status: 'approved' });
      }).toThrow(/Cannot verify/);
    });

    test('Promotes approved candidate without changing bbox', () => {
      const verified = AnnotationVerificationService.processVerification(mockWeakCandidate, { status: 'approved' });
      expect(verified.provenance).toBe('proprietary_human_verified');
      expect(verified.bbox).toEqual([0.5, 0.5, 0.2, 0.2]);
      expect(verified.reviewStatus).toBe('approved');
    });

    test('Promotes corrected candidate with updated bbox', () => {
      const newBox = [0.6, 0.6, 0.1, 0.1];
      const verified = AnnotationVerificationService.processVerification(mockWeakCandidate, { status: 'corrected', finalBBox: newBox });
      expect(verified.bbox).toEqual(newBox);
      expect(verified.originalCandidateBBox).toEqual([0.5, 0.5, 0.2, 0.2]); // Preserves original for auditing
    });

    test('Returns null on rejection', () => {
      const result = AnnotationVerificationService.processVerification(mockWeakCandidate, { status: 'rejected' });
      expect(result).toBeNull();
    });

    test('ensureNoWeakCandidates throws fatal error if contamination found', () => {
      const finalDataset = [
        { provenance: 'proprietary_human_verified' },
        { provenance: 'weak_candidate' } // Contamination!
      ];
      expect(() => {
        AnnotationVerificationService.ensureNoWeakCandidates(finalDataset);
      }).toThrow(/FATAL/);
    });
  });

  describe('Augmentation Service Blueprint', () => {
    test('Throws error if attempting to augment non-training image', () => {
      expect(() => {
        AugmentationService.createAugmentedMetadata({ role: 'VALIDATION' }, {}, 'v1');
      }).toThrow(/restricted to TRAINING/);
    });

    test('Generates strict provenance metadata for augmented images', () => {
      const source = { imageId: 'img1', productId: 'prod1', role: 'TRAINING' };
      const meta = AugmentationService.createAugmentedMetadata(source, { blur: true }, 'v1');
      expect(meta.provenance).toBe('synthetic');
      expect(meta.productId).toBe('prod1'); // Product ID must carry over
      expect(meta.sourceImageId).toBe('img1');
    });

    test('Transforms bounding box with shift and scale', () => {
      // Box at center [0.5, 0.5], width 0.2, height 0.2
      const box = [0.5, 0.5, 0.2, 0.2];
      
      // Shift right by 10%, zoom in by 20%
      const newBox = AugmentationService.transformBoundingBox(box, { shiftX: 0.1, scaleX: 1.2, scaleY: 1.2 });
      
      // cx: (0.5 + 0.1) * 1.2 = 0.6 * 1.2 = 0.72
      // w: 0.2 * 1.2 = 0.24
      expect(newBox[0]).toBeCloseTo(0.72);
      expect(newBox[2]).toBeCloseTo(0.24);
    });

    test('Returns null if transformation pushes box entirely off-screen', () => {
      const box = [0.9, 0.5, 0.2, 0.2];
      const newBox = AugmentationService.transformBoundingBox(box, { shiftX: 0.3 }); // Push cx to 1.2 (offscreen)
      expect(newBox).toBeNull();
    });
  });

  describe('Training Readiness Service', () => {
    test('Returns NOT_READY for the current 20-image dataset', () => {
      const result = TrainingReadinessService.evaluateReadiness({ uniqueProducts: 10, humanVerifiedCount: 0 });
      expect(result.status).toBe('NOT_READY');
    });

    test('Returns READY_FOR_SMALL_EXPERIMENT for borderline datasets', () => {
      const result = TrainingReadinessService.evaluateReadiness({ uniqueProducts: 55, humanVerifiedCount: 150 });
      expect(result.status).toBe('READY_FOR_SMALL_EXPERIMENT');
    });

    test('Returns READY_FOR_TRAINING for compliant datasets', () => {
      const result = TrainingReadinessService.evaluateReadiness({ uniqueProducts: 120, humanVerifiedCount: 250 });
      expect(result.status).toBe('READY_FOR_TRAINING');
    });
  });
});
