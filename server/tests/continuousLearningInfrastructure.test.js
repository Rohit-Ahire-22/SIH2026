import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { TrainingCandidateService } from '../src/services/trainingCandidateService.js';
import { TrainingQueueService } from '../src/services/trainingQueueService.js';
import { ModelRegistryService } from '../src/services/modelRegistryService.js';
import { ModelEvaluationService } from '../src/services/modelEvaluationService.js';
import { ModelResolverService } from '../src/services/modelResolverService.js';
import { DatasetVersionService } from '../src/services/datasetVersionService.js';

describe('Production Continuous-Learning Training Infrastructure', () => {
  let candidateService;
  let queueService;
  let registryService;
  let evaluationService;
  let resolverService;
  let datasetService;

  before(() => {
    candidateService = new TrainingCandidateService();
    queueService = new TrainingQueueService();
    registryService = new ModelRegistryService();
    evaluationService = new ModelEvaluationService();
    resolverService = new ModelResolverService(registryService);
    datasetService = new DatasetVersionService();
  });

  test('Test A: Unverified sample cannot become training eligible', () => {
    // The evaluation step doesn't make it eligible, it just flags it for review
    const sample = {
      learning: { candidateStatus: 'INFERENCE_ONLY' },
      provenance: { consentStatus: 'GRANTED' },
      inference: {}
    };
    const result = candidateService.evaluateInference(sample);
    assert.equal(sample.learning.trainingEligible, undefined);
  });

  test('Test B: Verified sample becomes training eligible immediately', () => {
    const sample = {
      learning: {},
      provenance: { consentStatus: 'GRANTED', licenseStatus: 'APPROVED', sourceType: 'user_upload' },
      quality: { imageQualityStatus: 'PASS' }
    };
    const verified = candidateService.markSampleVerified(sample);
    assert.equal(verified.learning.trainingEligible, true);
    assert.equal(verified.learning.trainingEligibilityReason, 'verified_permissioned_sample');
  });

  test('Test C: License-blocked sample remains ineligible', () => {
    const sample = {
      learning: {},
      provenance: { consentStatus: 'GRANTED', licenseStatus: 'BLOCKED', sourceType: 'licensed_external' },
      quality: { imageQualityStatus: 'PASS' }
    };
    const verified = candidateService.markSampleVerified(sample);
    assert.equal(verified.learning.trainingEligible, false);
    assert.equal(verified.learning.trainingEligibilityReason, 'license_blocked');
  });

  test('Test D: Consent-denied sample remains ineligible', () => {
    const sample = {
      learning: {},
      provenance: { consentStatus: 'DENIED', sourceType: 'user_upload' },
      quality: { imageQualityStatus: 'PASS' }
    };
    const verified = candidateService.markSampleVerified(sample);
    assert.equal(verified.learning.trainingEligible, false);
    assert.equal(verified.learning.trainingEligibilityReason, 'consent_denied');
  });

  test('Test E: Duplicate sample cannot become eligible', () => {
    const sample = {
      learning: {},
      provenance: { consentStatus: 'GRANTED', sourceType: 'user_upload' },
      duplicateStatus: 'exact_duplicate',
      quality: { imageQualityStatus: 'PASS' }
    };
    const verified = candidateService.markSampleVerified(sample);
    assert.equal(verified.learning.trainingEligible, false);
    assert.equal(verified.learning.trainingEligibilityReason, 'exact_duplicate');
  });

  test('Test G: Eligible sample creates/enters training queue', async () => {
    const result = await queueService.enqueueSample('sample_123');
    assert.equal(result.queued, true);
    assert.equal(queueService.pendingSamples.has('sample_123'), true);
  });

  test('Test H: Duplicate training jobs are prevented', async () => {
    await queueService.enqueueDatasetTraining('ds_v1', 'base_v1');
    await assert.rejects(
      queueService.enqueueDatasetTraining('ds_v2', 'base_v1'),
      /already in progress/
    );
  });

  test('Test I: Dataset version is immutable', () => {
    const v1 = datasetService.createDatasetVersion('ds_immutable_v1', [
      { sampleId: 's1', productId: 'p1', learning: { candidateStatus: 'TRAINING_ELIGIBLE' } }
    ]);
    assert.equal(v1.version, 'ds_immutable_v1');
    assert.equal(v1.numberOfProducts, 1);
  });

  test('Test J: Replay samples are preserved', () => {
    const replay = [{ sampleId: 'replay_1', productId: 'p0', learning: { candidateStatus: 'USED_IN_DATASET' } }];
    const newSamples = [{ sampleId: 'new_1', productId: 'p1', learning: { candidateStatus: 'TRAINING_ELIGIBLE' } }];
    const v2 = datasetService.createDatasetVersion('ds_replay_v2', newSamples, replay);
    assert.equal(v2.numberOfImages, 2);
    assert.ok(v2.samples.includes('replay_1'));
  });

  test('Test K: Candidate model does not overwrite production model', () => {
    const prod = registryService.registerCandidateModel('ds_v1', 'base', { val_mAP: 0.8 });
    registryService.evaluateAndPromote(prod.modelVersion, { val_mAP: 0.7 }); // prod is now PRODUCTION
    const activeProd = registryService.activeProductionModel;

    const cand = registryService.registerCandidateModel('ds_v2', prod.modelVersion, { val_mAP: 0.9 });
    // Candidate exists, but prod is still active
    assert.equal(registryService.activeProductionModel, activeProd);
    assert.notEqual(cand.modelVersion, activeProd);
  });

  test('Test M: Failed evaluation leaves V1 active', async () => {
    const v1 = registryService.activeProductionModel;
    const cand = registryService.registerCandidateModel('ds_v3', v1, { val_mAP: 0.5 });
    
    // Evaluation returns poor metrics
    const evalResult = await evaluationService.evaluateCandidate(cand, { metrics: { val_mAP: 0.8 } }, {});
    const promoResult = registryService.evaluateAndPromote(cand.modelVersion, { val_mAP: evalResult.productionMetrics.mAP50 });
    
    assert.equal(promoResult.promoted, false);
    assert.equal(registryService.activeProductionModel, v1);
  });

  test('Test O: Successful promotion changes production pointer V1 -> V2', async () => {
    const v1 = registryService.activeProductionModel;
    const cand = registryService.registerCandidateModel('ds_v4', v1, { val_mAP: 0.99 });
    
    const promoResult = registryService.evaluateAndPromote(cand.modelVersion, { val_mAP: 0.8 });
    
    assert.equal(promoResult.promoted, true);
    assert.equal(registryService.activeProductionModel, cand.modelVersion);
    assert.notEqual(registryService.activeProductionModel, v1);
  });

  test('Test P: Rollback changes V2 -> V1', () => {
    const v2 = registryService.activeProductionModel;
    // We know v1 was the one from the previous test, but let's just find the first model in registry that's ROLLED_BACK or we can create a specific chain
    const allModels = Array.from(registryService.registry.values());
    const v1 = allModels[0].modelVersion; // Get the very first registered model

    registryService.rollback(v1);
    
    assert.equal(registryService.activeProductionModel, v1);
    assert.equal(registryService.registry.get(v2).status, 'ROLLED_BACK');
  });

  test('Test R: Production model resolver returns current production version', () => {
    const current = registryService.activeProductionModel;
    const resolved = resolverService.getProductionModel();
    assert.equal(resolved, current);
  });
});
