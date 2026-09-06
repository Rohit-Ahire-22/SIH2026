# Model Evaluation Gate (v1)

## Overview
The Automated Model Evaluation Gate is the decisive phase in the SIH26034 Continuous Learning Pipeline, sitting strictly between Training Artifact Generation (Step 43) and Deployment (Step 45). It compares the newly generated candidate YOLO model against the active production champion to ensure mathematical superiority and prevent regression, utilizing an immutable, verified holdout dataset.

## Current Dataset Limitations
- **Current Products**: 20
- **Total Images**: 40
- **Verified Evaluation Annotations**: 0
Because the dataset is missing human-verified annotations within the evaluation/test split, this gate currently enforces `EVALUATION_BLOCKED_NOT_READY`. No models are evaluated or promoted, protecting the system from hallucinated feedback.

## Quality Gates & Thresholds
Defined centrally in `evaluation_config.yaml`:
1. **Absolute Minimums**: Candidates must score above baseline ML quality (e.g., mAP50 > 0.70).
2. **Regression Tolerance**: A candidate cannot degrade metrics (e.g., `mAP50_95_drop`) compared to the champion model beyond strict bounds (e.g., maximum drop of `0.03`).

## Node ↔ Python Architecture
1. **Python `evaluate_worker.py`**: Executes the heavy YOLO inferences (`.val()`) securely. It ensures the isolation of the `test` split products, strictly requiring human-verified ground truths. Computes deltas (`candidateMetrics - championMetrics`) and produces the deterministic output (`PASS` or `REJECT`).
2. **Node.js Orchestration**: Invokes the Python worker via `child_process`.
3. **Model Registry Updates**: Translates the output into Candidate Metadata (`EVALUATION_PASSED` or `REJECTED`).

**IMPORTANT**: A status of `EVALUATION_PASSED` strictly labels the candidate for the next deployment phase. This pipeline NEVER overwrites or alters the `activeProductionModel` artifact.
