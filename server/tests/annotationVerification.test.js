import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { AnnotationEligibilityService } from '../src/services/annotationEligibilityService.js';

describe('Annotation Verification & Eligibility', () => {
  let service;

  before(async () => {
    service = new AnnotationEligibilityService();
    await service.init();
  });

  test('Test 1: Weak candidate cannot become training eligible automatically', () => {
    const annotation = {
      boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 },
      classId: 2,
      provenance: 'weak_candidate',
      verificationStatus: 'PENDING',
      sourceLicense: 'proprietary'
    };

    const report = service.evaluateEligibility(annotation);
    assert.equal(report.isEligible, false);
    assert.ok(report.reasons.some(r => r.includes('Invalid provenance')));
    assert.ok(report.reasons.some(r => r.includes('Invalid verification status')));
  });

  test('Test 2: ACCEPT creates verified annotation', () => {
    const annotation = {
      boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 },
      classId: 2,
      provenance: 'weak_candidate',
      verificationStatus: 'PENDING',
      sourceLicense: 'proprietary'
    };

    const updated = service.processVerification(annotation, { action: 'ACCEPT' });
    
    assert.equal(updated.verificationStatus, 'ACCEPTED');
    assert.equal(updated.provenance, 'human_verified');
    assert.equal(updated.trainingEligible, true);
    assert.equal(updated.reviewerId, 'local_reviewer');
  });

  test('Test 3: CORRECT creates corrected annotation and saves history', () => {
    const annotation = {
      boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 },
      classId: 2,
      provenance: 'weak_candidate',
      verificationStatus: 'PENDING',
      sourceLicense: 'proprietary'
    };

    const updated = service.processVerification(annotation, { 
      action: 'CORRECT', 
      bbox: { xCenter: 0.6, yCenter: 0.6, width: 0.3, height: 0.3 },
      classId: 1
    });
    
    assert.equal(updated.verificationStatus, 'CORRECTED');
    assert.equal(updated.provenance, 'human_corrected');
    assert.equal(updated.trainingEligible, true);
    
    assert.equal(updated.originalBoundingBox.xCenter, 0.5);
    assert.equal(updated.boundingBox.xCenter, 0.6);
    assert.equal(updated.originalClassId, 2);
    assert.equal(updated.classId, 1);
  });

  test('Test 4: REJECT prevents training eligibility', () => {
    const annotation = {
      boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 },
      classId: 2,
      provenance: 'weak_candidate',
      verificationStatus: 'PENDING',
      sourceLicense: 'proprietary'
    };

    const updated = service.processVerification(annotation, { action: 'REJECT' });
    
    assert.equal(updated.verificationStatus, 'REJECTED');
    assert.equal(updated.provenance, 'weak_candidate');
    assert.equal(updated.trainingEligible, false);
  });

  test('Test 5: Invalid bbox rejected', () => {
    const annotation = {
      boundingBox: { xCenter: 1.5, yCenter: 0.5, width: 0.2, height: 0.2 },
      classId: 2,
      provenance: 'human_verified',
      verificationStatus: 'ACCEPTED',
      sourceLicense: 'proprietary'
    };

    const report = service.evaluateEligibility(annotation);
    assert.equal(report.isEligible, false);
    assert.ok(report.reasons.some(r => r.includes('Invalid bounding box')));
  });

  test('Test 6: Invalid class rejected', () => {
    const annotation = {
      boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 },
      classId: 99,
      provenance: 'human_verified',
      verificationStatus: 'ACCEPTED',
      sourceLicense: 'proprietary'
    };

    const report = service.evaluateEligibility(annotation);
    assert.equal(report.isEligible, false);
    assert.ok(report.reasons.some(r => r.includes('Invalid class ID')));
  });

  test('Test 7: License gate blocks unapproved sources', () => {
    const annotation = {
      boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 },
      classId: 2,
      provenance: 'human_verified',
      verificationStatus: 'ACCEPTED',
      sourceLicense: 'CC-BY-SA 3.0' // E.g., Open Food Facts
    };

    const report = service.evaluateEligibility(annotation);
    assert.equal(report.isEligible, false);
    assert.ok(report.reasons.some(r => r.includes('Source license is not approved')));
  });

  test('Test 8: Product-level split leakage is prevented', () => {
    const split1 = service.assignSplit('product_001', 'train');
    const split2 = service.assignSplit('product_001', 'validation');
    
    assert.equal(split1, 'train');
    assert.equal(split2, 'train', 'Should return the originally assigned split, ignoring the requested validation split.');
  });
});
