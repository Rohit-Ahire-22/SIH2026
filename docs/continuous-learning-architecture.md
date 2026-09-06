# Continuous Learning Architecture

## Dataset Readiness vs. Training Eligibility
- **Dataset Readiness**: A strict gate requiring 50 unique products and 100 human-verified annotations with 0 split leakage to establish a baseline training set.
- **Training Eligibility**: Independent of the global dataset readiness. A genuinely VERIFIED production image can become immediately training-eligible (`trainingEligible = true`) provided it passes license, consent, and integrity gates.

## Models
- `TrainingSample`: Tracks inference data, quality, learning state, provenance, and feedback.
- `TrainingJob`: Represents an asynchronous model training job tracking status (`QUEUED`, `TRAINING`, etc.), metrics, and base/candidate models.
- `DatasetVersion`: An immutable snapshot of training data (`DRAFT`, `READY`, `USED_FOR_TRAINING`, `SUPERSEDED`).

## Services
- `TrainingQueueService`: Decouples verification from dataset processing. Enqueues eligible samples.
- `ModelEvaluationService`: Deterministically evaluates candidate models against active production model V1 using a hold-out benchmark set.
- `ModelRegistryService`: Manages candidate registration, evaluation promotion, and rollback. Ensures the active model is cleanly tracked.
- `ModelResolverService`: Pluggable router used by Live Inference that fetches the current production model (and can handle canary splits).

## Verification to Training Lifecycle
1. User upload -> Inference -> Storage
2. Admin/Trusted User Verification via `POST /api/training-samples/:id/verify`.
3. Validation passes License / Consent / Duplicate Gates.
4. Set `trainingEligible = true`.
5. Insert into `TrainingQueueService` for dataset generation.
6. System generates immutable `DatasetVersion` (preserving replay benchmark data).
7. System enqueues `TrainingJob`.
8. Worker evaluates `Candidate Model`.
9. Candidate promoted if metrics exceed gates, else V1 remains active.
