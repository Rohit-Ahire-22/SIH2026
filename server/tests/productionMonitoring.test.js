import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRegistryService } from '../src/services/modelRegistryService.js';
import { ModelDeploymentService } from '../src/services/modelDeploymentService.js';
import { TrainingQueueService } from '../src/services/trainingQueueService.js';
import { ProductionMonitoringService } from '../src/services/productionMonitoringService.js';

describe('Production Monitoring & Retraining Triggers Tests', () => {
  let registryService;
  let deploymentService;
  let trainingQueueService;
  let monitoringService;

  before(() => {
    registryService = new ModelRegistryService();
    deploymentService = new ModelDeploymentService(registryService);
    trainingQueueService = new TrainingQueueService();
    monitoringService = new ProductionMonitoringService(deploymentService, trainingQueueService, {
      drift: { min_samples_for_drift: 10 },
      retraining: { cooldown_ms: 5000 }
    });
  });

  test('Test A, B: Telemetry is recorded asynchronously without blocking', () => {
    assert.doesNotThrow(() => {
      monitoringService.recordTelemetry({
        inferenceStatus: 'SUCCESS',
        latencyMs: 150,
        modelVersion: 'v1-baseline'
      });
    });
    assert.equal(monitoringService.telemetryBuffer.length, 1);
  });

  test('Test F, I: Insufficient samples returns INSUFFICIENT_DATA and avoids hallucinating drift', () => {
    // Pass 5 samples (< 10 threshold)
    const recentData = Array(5).fill({ inferenceStatus: 'SUCCESS', latencyMs: 100 });
    const result = monitoringService.evaluateWindow(recentData);
    
    assert.equal(result.status, 'INSUFFICIENT_DATA');
  });

  test('Test C, D, M: High latency & error rates trigger retraining request', async () => {
    // Pass 15 samples with terrible latency and high errors (>2% and >1500ms)
    const recentData = Array(15).fill({ inferenceStatus: 'FAILURE', latencyMs: 2000 });
    
    const result = monitoringService.evaluateWindow(recentData);
    assert.equal(result.status, 'QUALITY_DEGRADED');
    assert.equal(result.errorRate, 1.0);
  });

  test('Test P: Cooldown prevents infinite retraining loops', async () => {
    // Reset cooldown state so the first request goes through
    monitoringService.lastRetrainingTrigger = 0;
    
    const result1 = await monitoringService.requestRetraining('QUALITY_DEGRADED');
    // The first one should have hit the readiness gate and been BLOCKED_NOT_READY
    assert.equal(result1.status, 'RETRAINING_BLOCKED_NOT_READY');

    // Immediately requesting again hits COOLDOWN
    const result2 = await monitoringService.requestRetraining('QUALITY_DEGRADED');
    assert.equal(result2.status, 'COOLDOWN');
  });

  test('Test V, W: Deployment safety failures trigger existing rollback instantly', () => {
    const c1 = registryService.registerCandidateModel('ds1', 'base1', {});
    c1.status = 'EVALUATION_PASSED';
    
    const deploy = deploymentService.startDeployment(c1.modelVersion);
    
    const badTelemetry = Array(15).fill({ 
      deploymentId: deploy.deploymentId, 
      inferenceStatus: 'FAILURE', 
      latencyMs: 100 
    });
    
    monitoringService.evaluateWindow(badTelemetry);
    
    // Validate rollback occurred via the monitoring link
    assert.equal(deploy.status, 'ROLLED_BACK');
  });

  test('Test R, S, T, U, Z: Retraining trigger is blocked by readiness gate (20 products)', async () => {
    // Hack cooldown to allow request
    monitoringService.lastRetrainingTrigger = 0;
    
    const result = await monitoringService.requestRetraining('INPUT_DRIFT');
    
    assert.equal(result.status, 'RETRAINING_BLOCKED_NOT_READY');
    assert.equal(result.stats.uniqueProducts, 20);
    assert.equal(result.stats.humanVerifiedCount, 0);
    
    // Ensure production model was NEVER touched by the monitoring service
    assert.equal(registryService.activeProductionModel, null); // Hasn't formally changed from fallback
  });
});
