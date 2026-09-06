# Dataset Scaling & Acquisition Report v1

## 1. Current Dataset State
- **Unique Products**: 10
- **Total Images**: 20
- **Front Images**: 10
- **Back/Declaration Images**: 10
- **Human Verified Annotations**: 0
- **Weak Candidates**: 10
- **Training Readiness**: NOT_READY
- **Current Milestone**: PRE_MILESTONE

## 2. Source & Licensing Pipeline
An acquisition queue architecture (`simulateAcquisitionPipeline.js`) was implemented to enforce strict ingestion gates:
1. **License Gate**: Blocks all unknown or prohibited sources (e.g., e-commerce scraping).
2. **Quality Gate**: Rejects images below 300x300 pixel resolution.
3. **Duplicate Detection Gate**: Enforces exact uniqueness via SHA-256 hash comparison.
4. **Provenance Check**: Validates `sourceUrl` and `acquisitionTimestamp` presence.

## 3. Product-Level Splitting & Milestones
Dataset diversity is exclusively calculated by unique **Products**, not arbitrary image counts. Splitting between Train/Val/Test is isolated strictly by Product ID to prevent leakage.

**Target Milestones:**
- **MILESTONE A**: 25 products / 50+ verified annotations
- **MILESTONE B**: 50 products / 100+ verified annotations
- **MILESTONE C**: 75 products / 150+ verified annotations
- **MILESTONE D**: 100 products / 200+ verified annotations

## 4. Next Actions
- Solicit additional proprietary image uploads.
- Route Open Food Facts images explicitly to a `PRETRAINING_SUPPORT` pipeline, preventing pollution of the `GROUND_TRUTH` legal evaluation dataset.
