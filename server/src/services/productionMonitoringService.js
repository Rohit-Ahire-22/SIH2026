export class ProductionMonitoringService {
  constructor(modelDeploymentService, trainingQueueService, config) {
    this.deploymentService = modelDeploymentService;
    this.trainingQueueService = trainingQueueService;
    this.config = config || {
      drift: { min_samples_for_drift: 1000 },
      retraining: { cooldown_ms: 86400000 }
    };
    
    // In-memory buffer for async non-blocking telemetry ingestion
    this.telemetryBuffer = [];
    this.lastRetrainingTrigger = 0;
  }

  /**
   * Asynchronous, non-blocking telemetry ingestion.
   * Callers don't await this inside the inference critical path.
   */
  recordTelemetry(telemetryData) {
    // In production, push to BullMQ or Kafka. Here we buffer in memory.
    this.telemetryBuffer.push({
      ...telemetryData,
      timestamp: new Date()
    });
    
    // Async flush decoupled from request
    if (this.telemetryBuffer.length >= 100) {
      this._flushTelemetry().catch(err => console.error("Telemetry flush failed", err));
    }
  }

  async _flushTelemetry() {
    const batch = this.telemetryBuffer.splice(0, this.telemetryBuffer.length);
    if (batch.length === 0) return;
    
    // Simulate DB bulk insert: await InferenceTelemetry.insertMany(batch)
    // For evaluating windows dynamically:
    this.evaluateWindow(batch);
  }

  /**
   * Evaluates the current monitoring window for a set of data points.
   * Determines if deployment safety is breached (Canary Rollback) or if
   * statistical drift warrants a retraining request.
   */
  evaluateWindow(recentData) {
    if (!recentData || recentData.length === 0) return { status: 'HEALTHY' };

    let totalLatency = 0;
    let errors = 0;
    let timeouts = 0;
    
    const byDeployment = new Map();

    for (const record of recentData) {
      totalLatency += record.latencyMs || 0;
      if (record.inferenceStatus === 'FAILURE') errors++;
      if (record.inferenceStatus === 'TIMEOUT') timeouts++;
      
      if (record.deploymentId) {
        if (!byDeployment.has(record.deploymentId)) {
          byDeployment.set(record.deploymentId, { samples: 0, errors: 0 });
        }
        const dStats = byDeployment.get(record.deploymentId);
        dStats.samples++;
        if (record.inferenceStatus === 'FAILURE') dStats.errors++;
      }
    }

    const totalSamples = recentData.length;
    const errorRate = errors / totalSamples;
    const avgLatency = totalLatency / totalSamples;

    // 1. Safe Deployment Integration: Check active deployments
    for (const [deploymentId, stats] of byDeployment.entries()) {
      const depErrorRate = stats.errors / stats.samples;
      // If a specific deployment violates a hard limit, invoke deployment rollback
      if (depErrorRate > 0.05 && stats.samples >= 10) {
        try {
          this.deploymentService.triggerRollback(deploymentId, `Monitoring triggered rollback: error rate ${depErrorRate}`);
        } catch (e) {
          // Fail safely if deployment already rolled back
        }
      }
    }

    // 2. Drift / Degradation checks
    if (totalSamples < this.config.drift.min_samples_for_drift) {
      return { status: 'INSUFFICIENT_DATA', samples: totalSamples };
    }

    if (errorRate > 0.02 || avgLatency > 1500) {
      this.requestRetraining('QUALITY_DEGRADED');
      return { status: 'QUALITY_DEGRADED', errorRate, avgLatency };
    }

    // Checking for Input Distribution drift would happen here mathematically (e.g. Wasserstein on blurProxy)
    
    return { status: 'HEALTHY' };
  }

  /**
   * Requests a retraining loop due to degradation or dataset growth.
   * Enforces cooldowns. Does NOT directly train. Routes to TrainingQueueService.
   */
  async requestRetraining(reason) {
    const now = Date.now();
    if (now - this.lastRetrainingTrigger < this.config.retraining.cooldown_ms) {
      return { status: 'COOLDOWN', reason: 'Retraining requested too recently' };
    }

    this.lastRetrainingTrigger = now;

    // Dispatches to the strict readiness queue.
    // If the dataset isn't ready (e.g., 20 products), the queue correctly returns BLOCKED.
    return await this.trainingQueueService.handleRetrainingRequest({
      reason,
      timestamp: new Date()
    });
  }
}
