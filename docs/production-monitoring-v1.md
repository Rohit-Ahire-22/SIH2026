# Production Monitoring & Drift Detection (v1)

## Overview
The Production Monitoring service constitutes the final segment of the SIH26034 Continuous Learning loop. It observes production traffic asynchronously, monitors deployment safety, detects statistical degradation (like high error rates or input drift), and bridges the gap to automation by issuing `RETRAINING_REQUESTED` events.

## Architecture 
```text
Inference Endpoint 
↓ (non-blocking)
ProductionMonitoringService
↓ (evaluation window)
Drift / Degradation Detected
↓ (requestRetraining)
TrainingQueueService
↓ (readiness gate)
BLOCKED_NOT_READY (Currently, due to dataset constraints)
```

## Key Mechanisms
1. **Asynchronous Telemetry:** Records lightweight proxies (latency, classes detected, bounding box dimensions, inference status) in a memory buffer before flushing to MongoDB (`InferenceTelemetry`). This guarantees zero latency overhead on user uploads.
2. **Canary Safety Links:** If an evaluating window indicates a deployment's error rate surpasses `0.05` across >10 samples, it immediately interrupts the `ModelDeploymentService` to trigger a Rollback to the previous champion.
3. **Statistical Cooldowns:** Employs a 24-hour (`86400000` ms) cooldown between automated retraining requests. This securely prevents the system from spinning into an infinite training loop when data degrades fundamentally.
4. **Readiness Integrity:** A trigger is strictly a *request*. It does not start a YOLO training job unless the dataset formally possesses the minimum unique products (50) and verified annotations (100).
