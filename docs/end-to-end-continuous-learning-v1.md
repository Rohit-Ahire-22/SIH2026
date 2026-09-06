# End-to-End Continuous Learning Architecture (v1)

## Architecture Flow

```
                USER
                 │
                 ↓
              UPLOAD
                 │
                 ↓
            INGESTION
                 │
                 ↓
            VERIFICATION
                 │
          ┌──────┴──────┐
          │             │
       REJECTED       VERIFIED
                        │
                        ↓
              TRAINING ELIGIBILITY
                        │
                        ↓
                DATASET VERSION
                        │
                 READINESS GATE
                   /         \
                  /           \
             BLOCKED          READY
                               │
                               ↓
                            TRAINING
                               │
                               ↓
                            CANDIDATE
                               │
                               ↓
                           EVALUATION
                          /          \
                     REJECTED       PASSED
                                     │
                                     ↓
                                  SHADOW
                                     │
                                     ↓
                                  CANARY
                                  /    \
                            FAILURE    SUCCESS
                               │         │
                               ↓         ↓
                            ROLLBACK   PROMOTE
                               │         │
                               ↓         ↓
                           CHAMPION  PRODUCTION
                                         │
                                         ↓
                                     MONITORING
                                    /     |     \
                                 HEALTH  DRIFT  QUALITY
                                           │
                                           ↓
                                   RETRAIN REQUEST
                                           │
                                           ↓
                                    TRAINING QUEUE
                                           │
                                           ↺
```

## System Constraints & Production Security

This pipeline successfully governs the flow of a new product image from the initial HTTP upload route entirely through automated PyTorch YOLO generation, evaluation, traffic roll-out, and continuous monitoring.

**Crucially, the architecture incorporates strict Hard-Stop rules:**
1. **Verification Wall:** `TrainingReadinessService` blocks the core ML execution indefinitely until 50 highly unique products and 100 human-verified annotations accumulate.
2. **Evaluation Wall:** Passing YOLO evaluation enforces that verified baseline testing must mathematically out-perform the champion (mAP >= baseline).
3. **Rollback Wall:** Live inference telemetries running alongside Canary traffic instances immediately trigger automated model withdrawal if user-facing safety parameters (Latency > 1500ms, Error > 5%) degrade.
