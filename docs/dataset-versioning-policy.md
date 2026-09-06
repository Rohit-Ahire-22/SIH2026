# Dataset Versioning Policy

## 1. Immutable Snapshots
Datasets are immutable. Once `dataset-v1` is finalized, its images, split allocations, and annotations are frozen. Subsequent additions generate `dataset-v2`, `dataset-v3`, etc.

## 2. Product-Level Split Isolation
Images belonging to the same physical product (e.g. `product_021_front.jpg` and `product_021_back.jpg`) must ALWAYS reside in the exact same dataset split (train, validation, test). Allowing them to bridge splits leaks spatial/contextual data and ruins validation integrity.

## 3. Provenance and License Auditing
Each dataset version must compile a manifest of all constituent image hashes, ensuring no `INFERENCE_ONLY` or poorly-licensed imagery sneaked in.
