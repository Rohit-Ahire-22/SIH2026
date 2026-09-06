# Training Worker Architecture (v1)

## Overview
The SIH26034 Continuous-Learning Training Worker bridges the Node.js backend queues with actual Python ML execution (via YOLO/ultralytics). It enforces a strict dataset readiness policy, ensuring that the model is only fine-tuned when there are mathematically sufficient verified samples to avoid catastrophic forgetting and overfitting.

## Execution Model
The backend delegates training to `train_worker.py` via `child_process.execFile()`. The worker receives CLI parameters:
- `--job-id`
- `--dataset-version`
- `--dry-run` (optional)

### Output Protocol
The worker always terminates with a structural JSON output string emitted to `stdout`. The Node.js service parses this payload to update the `TrainingJob` status accurately.
If readiness checks fail, the status will be `BLOCKED_NOT_READY` with specific `reasonCodes`.

## Readiness Gates
The worker will block training (`BLOCKED_NOT_READY`) if ANY of the following strict requirements are not met:

1. **Product Count:** Minimum 50 unique products (`INSUFFICIENT_PRODUCTS`).
2. **Annotation Count:** Minimum 100 human-verified annotations (`INSUFFICIENT_VERIFIED_ANNOTATIONS`). Weak labels are NOT treated as verified ground truth.
3. **Data Integrity:** Bounding box coordinates must be normalized (0-1) with positive area (`INVALID_LABEL`).
4. **Leakage Protection:** The same product cannot exist across both train and validation splits (`PRODUCT_SPLIT_LEAKAGE`).
5. **License/Privacy:** The dataset must not include any images with `BLOCKED` licenses or `DENIED` user consent (`LICENSE_GATE_FAILED`, `PRIVACY_GATE_FAILED`).

## Model Artifacts
When training succeeds (e.g., when the readiness gates pass in the future), the worker will export a versioned CANDIDATE model to `ai-service/models/candidates/<job-id>`.
The worker NEVER automatically overrides the production active model in the registry; promotion is handled exclusively by the `ModelEvaluationService` gate.
