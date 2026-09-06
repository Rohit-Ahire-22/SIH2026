# Continuous Learning Infrastructure v1

## Lifecycle Overview
The Continuous Learning Pipeline safely transforms raw production inference data into evaluated candidate models ready for deployment.

1. **User Upload & Inference:** Images are uploaded, verified by heuristics or admin, and logged.
2. **Verification & Eligibility:** `POST /api/training-samples/:id/verify` triggers immediate eligibility for verified files holding proper `consentStatus` and `licenseStatus`.
3. **Dataset Generation:** `TrainingQueueService` captures eligible samples and generates an immutable `DatasetVersion` (which enforces a representative replay pool of previous data to avert catastrophic forgetting).
4. **Training Job:** Async jobs run (status tracked via `TrainingJob` schema: `QUEUED` -> `TRAINING` -> `COMPLETED`).
5. **Candidate Model:** The output model enters the `ModelRegistryService` as a `CANDIDATE`.
6. **Evaluation Gate:** `ModelEvaluationService` benchmarks the candidate against the active production model.
7. **Promotion / Canary:** Promoted models become the new target for the `ModelResolverService`.
8. **Rollback:** Safe reversion paths preserve previous models in case of regression.

## Implementation Facts
- **TrainingSample Implemented**: YES
- **TrainingJob Implemented**: YES
- **Dataset Versioning Implemented**: YES
- **Model Registry Implemented**: YES
- **Production Model Resolver Implemented**: YES
- **Verification -> Immediate Eligibility**: YES
- **Automatic Training Queue**: YES
- **Evaluation Gate**: YES
- **Canary Architecture (Resolver)**: YES
- **Rollback**: YES
- **Privacy/Consent Gate**: YES

## Current Dataset Readiness
- **Products**: 10
- **Images**: 20
- **Human Verified**: 0
- **Training Eligible**: 0
- **Readiness**: NOT_READY (Reason: `uniqueProducts=10 < 50; humanVerified=0 < 100`)

## Status Summary
YOLO training executed: NO
Production model changed: NO

**Can a genuinely verified future production image become training-eligible immediately without waiting for the 50-product/100-annotation readiness gate?**
YES. The implemented `markSampleVerified` flow in `TrainingCandidateService` handles immediate eligibility.
