import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRegistryService } from '../src/services/modelRegistryService.js';
import { ModelResolverService } from '../src/services/modelResolverService.js';
import { ModelDeploymentService } from '../src/services/modelDeploymentService.js';
import { ProductionMonitoringService } from '../src/services/productionMonitoringService.js';
import { TrainingQueueService } from '../src/services/trainingQueueService.js';

describe('SIH26034 Final End-to-End Continuous Learning Simulation', () => {
  // We use fully isolated local instances. The actual running server's instances are completely untouched.
  let registryService;
  let resolverService;
  let deploymentService;
  let queueService;
  let monitoringService;

  before(() => {
    registryService = new ModelRegistryService();
    resolverService = new ModelResolverService(registryService);
    deploymentService = new ModelDeploymentService(registryService, {
      safety_gates: { min_samples: 10, max_error_rate: 0.05 }
    });
    queueService = new TrainingQueueService();
    monitoringService = new ProductionMonitoringService(deploymentService, queueService, {
      drift: { min_samples_for_drift: 10 },
      retraining: { cooldown_ms: 5000 }
    });
  });

  test('Phase A & B: Simulated Upload, Verification & Annotation', () => {
    // 1. Ingestion: Simulated User Image -> Verified Image
    const imageMeta = { id: 'img_sim_1', status: 'VERIFIED', duplicateHash: 'abc123sha256' };
    
    // 2. Annotation: Verified YOLO coordinate representation
    const annotation = {
      imageId: 'img_sim_1',
      provenance: 'human_verified',
      verificationStatus: 'ACCEPTED',
      boxes: [{ classId: 0, x: 0.5, y: 0.5, w: 0.2, h: 0.2 }] // 0 = product_package
    };
    
    assert.equal(imageMeta.status, 'VERIFIED');
    assert.equal(annotation.provenance, 'human_verified');
    assert.equal(annotation.verificationStatus, 'ACCEPTED');
  });

  test('Phase C & D: Simulated Dataset Version & Readiness Bypass', async () => {
    // We override handleRetrainingRequest to simulate a dataset with >50 products specifically for this test's isolated queue
    queueService.handleRetrainingRequest = async function(trigger) {
      if (trigger.reason === 'SIMULATION_SUCCESS_PATH') {
        return { status: 'RETRAINING_QUEUED', jobId: 'sim_job_1' };
      }
      return { status: 'RETRAINING_BLOCKED_NOT_READY' };
    };

    const request = await monitoringService.requestRetraining('SIMULATION_SUCCESS_PATH');
    assert.equal(request.status, 'RETRAINING_QUEUED');
  });

  test('Phase E - K: Simulated Training, Candidate Registration, Evaluation & Promotion', () => {
    // Register candidate in isolated registry
    const candidate = registryService.registerCandidateModel('ds_sim_v1', 'base_sim_model', {});
    candidate.artifactPath = 'simulated/artifact/path.pt'; // Mock artifact existence
    assert.equal(candidate.status, 'CANDIDATE');

    // Simulate EVALUATION_PASSED
    registryService.updateCandidateEvaluationStatus(candidate.modelVersion, {
      decision: 'PASS',
      candidateMetrics: { mAP50: 0.95 },
      metricDeltas: {},
      reasons: []
    });
    assert.equal(candidate.status, 'EVALUATION_PASSED');

    // Begin Deployment
    const deploy = deploymentService.startDeployment(candidate.modelVersion);
    assert.equal(deploy.status, 'SHADOW');

    // Push through Canary stages safely
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 20, errorRate: 0.01 }); // CANARY_1
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 20, errorRate: 0.01 }); // CANARY_5
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 20, errorRate: 0.01 }); // CANARY_25
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 20, errorRate: 0.01 }); // CANARY_50
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 20, errorRate: 0.01 }); // PROMOTING
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 20, errorRate: 0.01 }); // PRODUCTION

    assert.equal(deploy.status, 'PRODUCTION');
    assert.equal(registryService.activeProductionModel, candidate.modelVersion);
    
    // Assure routing correctly points to the new simulation candidate
    assert.equal(resolverService.getProductionModel(), candidate.modelVersion);
  });

  test('Phase L - O: Real Dataset Fails Closed (No Training/Bypass)', async () => {
    // Create an entirely fresh queue with no hacks. It should natively read the 20-product rule.
    const realQueueService = new TrainingQueueService();
    const result = await realQueueService.handleRetrainingRequest({});
    
    assert.equal(result.status, 'RETRAINING_BLOCKED_NOT_READY');
    assert.equal(result.stats.uniqueProducts, 20); // 20 products real dataset limitation
  });

  test('Phase P - S: Failure & Rollback Simulation', () => {
    // Register a secondary candidate intended to fail
    const badCandidate = registryService.registerCandidateModel('ds_sim_v2', registryService.activeProductionModel, {});
    badCandidate.artifactPath = 'simulated/bad/path.pt';
    
    registryService.updateCandidateEvaluationStatus(badCandidate.modelVersion, { decision: 'PASS' });
    
    const badDeploy = deploymentService.startDeployment(badCandidate.modelVersion);
    
    // Advance to CANARY_1
    deploymentService.advanceDeployment(badDeploy.deploymentId, { samplesProcessed: 20, errorRate: 0 });
    assert.equal(badDeploy.status, 'CANARY_1');
    
    // Now trigger catastrophic telemetry via monitoring
    const badTelemetry = Array(20).fill({
      deploymentId: badDeploy.deploymentId,
      inferenceStatus: 'FAILURE',
      latencyMs: 100
    });
    
    monitoringService.evaluateWindow(badTelemetry);
    
    // The monitoring service automatically invoked triggerRollback
    assert.equal(badDeploy.status, 'ROLLED_BACK');
    assert.equal(badCandidate.status, 'ROLLED_BACK');
    
    // The active production model must be safely preserved
    assert.notEqual(registryService.activeProductionModel, badCandidate.modelVersion);
  });
  
  test('Phase T - V: Invalid State Transitions Rejected', () => {
    // Attempt to promote a rolled back model directly to production
    assert.throws(() => {
       registryService.promoteToProduction('simulated', 'sim_deploy');
    }, /Model not found/);
    
    const rCandidate = registryService.registerCandidateModel('ds', 'base', {});
    assert.throws(() => {
       registryService.promoteToProduction(rCandidate.modelVersion, 'sim_deploy');
    }, /Model must be in deployment pipeline to be promoted/);
  });
});
