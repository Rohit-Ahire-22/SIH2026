# Continuous Learning Lifecycle

The lifecycle describes how a single image uploaded by a public user ultimately improves the underlying detection models.

## 1. User Upload & Inference
A public user uploads an image. By default, `consentStatus` is set to `INFERENCE_ONLY`. The system executes Hybrid OCR and legal rule evaluation.

## 2. Selection & Feedback
If the inference scores high on `learningValueScore` (e.g. OCR timeout, missing fields) AND the user explicitly opts in, the image becomes a `CANDIDATE`. Users can optionally submit a correction via the frontend, updating the `correctedPrediction` without mutating the `originalPrediction`.

## 3. Human Verification
Admins review the `NEEDS_REVIEW` queue. They accept, correct, or reject the bounding box / OCR text. Upon acceptance, the image is marked `VERIFIED`.

## 4. Dataset Generation
When enough verified samples accumulate (e.g. +50 unique products), the system extracts these images, merges them with the `replay_dataset` to prevent catastrophic forgetting, and creates `dataset-vX`.

## 5. Model Training & Evaluation
A worker executes the training job. The resulting model undergoes a strict validation evaluation. If it does not exceed the baseline accuracy on core fields (MRP, Dates, etc.), it is marked `REJECTED`. If successful, it is promoted.
