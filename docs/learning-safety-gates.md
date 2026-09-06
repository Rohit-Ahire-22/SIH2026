# Learning Safety Gates

## 1. Legal Engine Independence
The SIH26034 project strictly divides ML models (OCR, Region of Interest detection) from the Legal Rule Engine. ML models detect raw visual fields (e.g. text blocks, strings); the Deterministic Rule Engine classifies those strings as PASS, FAIL, or REVIEW. Training NEVER occurs directly on legal decisions to prevent compliance drift.

## 2. Weak Supervision Integrity
OCR heuristic clustering outputs (weak candidates) are strictly prohibited from entering training datasets without explicit human verification (e.g. `ACCEPTED`, `CORRECTED` verification statuses).

## 3. Threshold Limits
Training jobs are physically gated behind configuration variables such as `MIN_UNIQUE_PRODUCTS` (e.g., 50) and `MIN_VERIFIED_ANNOTATIONS` (e.g., 100). The `calculateReadiness.js` logic enforces this. The existing 20-image dataset acts strictly as the seed baseline.
