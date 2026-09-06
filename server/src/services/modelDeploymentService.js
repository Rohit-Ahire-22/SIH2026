import crypto from 'crypto';

export class ModelDeploymentService {
  constructor(modelRegistryService, config) {
    this.modelRegistryService = modelRegistryService;
    this.config = config || {
      safety_gates: {
        min_samples: 100,
        max_error_rate: 0.05
      }
    };
    this.activeDeployments = new Map();
  }

  /**
   * Validates a candidate and starts a SHADOW deployment.
   */
  startDeployment(modelVersion) {
    const candidate = this.modelRegistryService.registry.get(modelVersion);
    if (!candidate) throw new Error('Candidate not found');

    if (candidate.status !== 'EVALUATION_PASSED') {
      throw new Error('Only EVALUATION_PASSED models can enter deployment');
    }

    if (!candidate.artifactPath) {
      throw new Error('Candidate without valid artifact cannot deploy');
    }

    // Check concurrency - only one active deployment
    for (const [id, dep] of this.activeDeployments.entries()) {
      if (dep.status !== 'ROLLED_BACK' && dep.status !== 'PRODUCTION') {
        throw new Error('Concurrent deployment attempt rejected');
      }
    }

    const championModelVersion = this.modelRegistryService.activeProductionModel;
    
    const deploymentId = `deploy-${crypto.randomUUID()}`;
    const deployment = {
      deploymentId,
      candidateModelVersion: modelVersion,
      championModelVersion,
      status: 'SHADOW',
      trafficPercentage: 0,
      startAt: new Date(),
      metrics: {
        samplesProcessed: 0,
        errorRate: 0,
        latencyP95: 0
      },
      auditLog: [{
        action: 'STARTED',
        timestamp: new Date(),
        details: { stage: 'SHADOW' }
      }]
    };

    candidate.status = 'SHADOW';
    this.modelRegistryService.activeDeployment = deployment;
    this.activeDeployments.set(deploymentId, deployment);
    
    return deployment;
  }

  advanceDeployment(deploymentId, newMetrics) {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    if (deployment.status === 'ROLLED_BACK' || deployment.status === 'PRODUCTION') {
      throw new Error('Invalid state transition');
    }

    // Accumulate metrics
    deployment.metrics.samplesProcessed += (newMetrics.samplesProcessed || 0);
    deployment.metrics.errorRate = newMetrics.errorRate || deployment.metrics.errorRate;

    // Safety Gates
    if (deployment.metrics.errorRate > this.config.safety_gates.max_error_rate) {
      return this.triggerRollback(deploymentId, 'Error rate exceeded threshold');
    }

    if (deployment.metrics.samplesProcessed < this.config.safety_gates.min_samples) {
      throw new Error('STAGE_INCONCLUSIVE: Insufficient samples');
    }

    // State machine advance
    const transitions = {
      'SHADOW': { next: 'CANARY_1', traffic: 1 },
      'CANARY_1': { next: 'CANARY_5', traffic: 5 },
      'CANARY_5': { next: 'CANARY_25', traffic: 25 },
      'CANARY_25': { next: 'CANARY_50', traffic: 50 },
      'CANARY_50': { next: 'PROMOTING', traffic: 100 },
      'PROMOTING': { next: 'PRODUCTION', traffic: 100 }
    };

    const nextState = transitions[deployment.status];
    if (!nextState) throw new Error('Invalid stage');

    deployment.status = nextState.next;
    deployment.trafficPercentage = nextState.traffic;
    deployment.metrics.samplesProcessed = 0; // Reset for next stage observation

    deployment.auditLog.push({
      action: 'ADVANCED',
      timestamp: new Date(),
      details: { stage: deployment.status, traffic: deployment.trafficPercentage }
    });

    if (deployment.status === 'PRODUCTION') {
      this.modelRegistryService.promoteToProduction(deployment.candidateModelVersion, deploymentId);
      deployment.endAt = new Date();
    }

    return deployment;
  }

  triggerRollback(deploymentId, reason) {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    deployment.status = 'ROLLED_BACK';
    deployment.trafficPercentage = 0;
    deployment.rollbackReason = reason;
    deployment.endAt = new Date();

    deployment.auditLog.push({
      action: 'ROLLED_BACK',
      timestamp: new Date(),
      details: { reason }
    });

    // Revert candidate state
    const candidate = this.modelRegistryService.registry.get(deployment.candidateModelVersion);
    if (candidate) {
      candidate.status = 'ROLLED_BACK';
    }

    this.modelRegistryService.activeDeployment = null;

    return deployment;
  }
}
