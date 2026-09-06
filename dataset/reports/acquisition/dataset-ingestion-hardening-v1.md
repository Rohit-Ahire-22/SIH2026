# Dataset Ingestion Hardening Report v1

> This step does not make the dataset training-ready.

## Readiness
- **Training Readiness**: NOT_READY
- **Reason**: uniqueProducts=10 < 50; humanVerified=0 < 100

## Dataset
- **Unique Products**: 10
- **Total Images**: 20
- **Views**: front=10, back=10, declaration=0, unknown=0
- **Category Distribution**: {"unknown":20}
- **Unknown Category Count**: 20
- **Products With Declaration Views**: 0
- **Products Missing Declaration Views**: 10
- **Avg Dimensions**: 1292.3x1118.3
- **Median Dimensions**: 1140x1000.5

## Deduplication
- **Exact Duplicates**: 0
- **Near Duplicates (flagged, retained)**: 0
- **Unique Images**: 20
- **Malformed Images**: 0

## Verification Queue
- **Queue Size**: 20
- **Priority Breakdown**: {"1":10,"4":10}

## Annotations
- **Human Verified**: 0
- **Pending**: 10

## Integrity
- **Split Leakage**: 0
- **License Blockers**: 0

> Note: Views and categories are INFERRED metadata (provenance recorded), not verified labels.