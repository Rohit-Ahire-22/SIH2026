import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRegistryService } from '../src/services/modelRegistryService.js';
import { ModelDeploymentService } from '../src/services/modelDeploymentService.js';
import { ModelResolverService } from '../src/services/modelResolverService.js';

describe('Model Deployment Gate Tests', () => {
  let registryService;
  let deploymentService;
  let resolverService;

  before(() => {
    registryService = new ModelRegistryService();
    deploymentService = new ModelDeploymentService(registryService);
    resolverService = new ModelResolverService(registryService);
  });

  test('Test A, B: Un-evaluated or un-registered candidate cannot deploy', () => {
    assert.throws(() => {
      deploymentService.startDeployment('non_existent');
    }, /Candidate not found/);

    const c1 = registryService.registerCandidateModel('ds1', 'base1', {});
    assert.throws(() => {
      deploymentService.startDeployment(c1.modelVersion);
    }, /Only EVALUATION_PASSED models can enter deployment/);
  });

  test('Test D, E: Eligible candidate enters shadow mode, routing ignores it', () => {
    const c2 = registryService.registerCandidateModel('ds2', 'base2', {});
    c2.status = 'EVALUATION_PASSED'; // Mock evaluation
    
    const deployment = deploymentService.startDeployment(c2.modelVersion);
    assert.equal(deployment.status, 'SHADOW');
    assert.equal(deployment.trafficPercentage, 0);

    // Resolver should not route real traffic to a SHADOW model
    const productionModel = resolverService.getProductionModel();
    assert.equal(productionModel, 'v1-baseline');

    // Shadow model should be available for background tasks
    const shadowModel = resolverService.getShadowModel();
    assert.equal(shadowModel, c2.modelVersion);
  });

  test('Test F, H, I: Error rate spikes trigger rollback', () => {
    const deploymentId = registryService.activeDeployment.deploymentId;
    
    // Attempting to advance without min samples throws
    assert.throws(() => {
      deploymentService.advanceDeployment(deploymentId, { samplesProcessed: 10, errorRate: 0 });
    }, /STAGE_INCONCLUSIVE/);

    // Provide enough samples but an excessive error rate
    const rolledBack = deploymentService.advanceDeployment(deploymentId, { samplesProcessed: 100, errorRate: 0.10 });
    assert.equal(rolledBack.status, 'ROLLED_BACK');
    assert.equal(rolledBack.trafficPercentage, 0);
    
    const c2 = registryService.registry.get(rolledBack.candidateModelVersion);
    assert.equal(c2.status, 'ROLLED_BACK');
  });

  test('Test G: Canary routing is deterministic', () => {
    const c3 = registryService.registerCandidateModel('ds3', 'base3', {});
    c3.status = 'EVALUATION_PASSED';
    
    const deploy = deploymentService.startDeployment(c3.modelVersion);
    // Advance to CANARY_50
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 200, errorRate: 0 });
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 200, errorRate: 0 });
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 200, errorRate: 0 });
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 200, errorRate: 0 });

    assert.equal(deploy.status, 'CANARY_50');

    // Deterministic Routing: The same correlationId should ALWAYS yield the same model
    const result1 = resolverService.getProductionModel({ correlationId: 'user-xyz' });
    const result2 = resolverService.getProductionModel({ correlationId: 'user-xyz' });
    
    assert.equal(result1, result2);
    
    const result3 = resolverService.getProductionModel({ correlationId: 'user-abc' });
    const result4 = resolverService.getProductionModel({ correlationId: 'user-abc' });
    
    assert.equal(result3, result4);
  });

  test('Test O, P, Q: Successful canary stages transition to promotion', () => {
    const deploy = registryService.activeDeployment;
    
    // From CANARY_50 to PROMOTING
    deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 200, errorRate: 0 });
    assert.equal(deploy.status, 'PROMOTING');
    
    // PROMOTING to PRODUCTION
    const final = deploymentService.advanceDeployment(deploy.deploymentId, { samplesProcessed: 200, errorRate: 0 });
    assert.equal(final.status, 'PRODUCTION');
    
    // Registry should have updated activeProductionModel
    assert.equal(registryService.activeProductionModel, deploy.candidateModelVersion);
    assert.equal(registryService.activeDeployment, null);
  });
  
  test('Test U: Production model untouched on empty current state', () => {
    // Current state has NO evaluation_passed candidate.
    // The previously verified baseline remains intact.
    const active = resolverService.getProductionModel({ correlationId: 'random' });
    assert.ok(active !== null);
  });
});
