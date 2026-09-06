# Model Versioning Policy

## 1. Registry Architecture
The model registry tracks every trained model candidate indefinitely. It is located at `ai-service/models/registry/model-registry.json` and supports states: `EXPERIMENTAL`, `CANDIDATE`, `SHADOW`, `CANARY`, `PRODUCTION`, `REJECTED`, `ROLLED_BACK`.

## 2. Promotion Logic
A model can only be promoted to `PRODUCTION` if:
1. It is currently a `CANDIDATE` or `SHADOW`.
2. It successfully passes the Model Evaluation Gate, outperforming or matching the current production model on key precision/recall benchmarks.

## 3. Rollback
In the event of a catastrophic failure in production, an API endpoint (e.g. `POST /api/models/:version/rollback`) instantly swaps the `activeModels` pointer back to the previous stable version. The failing model is marked `ROLLED_BACK`. It is never deleted from disk to preserve forensics.
