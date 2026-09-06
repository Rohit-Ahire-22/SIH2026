# Training Artifact Pipeline (v1)

## Overview
The SIH26034 project uses a complete production-grade pipeline bridging dataset verification to YOLO training and candidate model registration. This ensures that only data meeting strict quality thresholds are transformed into deployable model artifacts.

## Current Dataset State
- **Products**: 20
- **Images**: 40
- **Human Verified Annotations**: 0

**Required Thresholds**: 
- 50 Unique Products
- 100 Verified Annotations

**Current Status**: `BLOCKED_NOT_READY`
The pipeline safely stops execution before dataset materialization or training can occur, protecting the registry from sub-standard models.

## Pipeline Architecture
### 1. DatasetVersion Snapshot
A `DatasetVersion` document is created in the database to freeze the dataset at its current state. It tracks immutability flags and provenance (number of products, annotations, leakage checks, source).
### 2. YOLO Dataset Materialization
When readiness passes, the Python worker (`train_worker.py`) creates an isolated YOLO workspace, copying verified images and converting bounding boxes into normalized txt labels inside `images/train`, `labels/train`, etc.
### 3. Real Training Invocation
Using `ultralytics`, the worker triggers a full YOLO fine-tuning epoch set on the CPU/GPU, reading configuration from `training_config.yaml`.
### 4. Artifact Validation
After training completes, the worker inspects `best.pt`. If it exists and is non-empty, a SHA-256 checksum is generated for absolute artifact provenance.
### 5. Candidate Registry
The backend receives the payload encompassing the checksum and metrics. It marks the `TrainingJob` as `CANDIDATE_READY`.
The production model remains **completely isolated and unchanged**.

## Failure Behavior
If any constraint fails, the system fails closed. 
- A missing artifact yields `ARTIFACT_INVALID`.
- Split leakage, insufficient products, or invalid constraints yield `BLOCKED_NOT_READY`.
All failures are logged to the `TrainingJob` model.
