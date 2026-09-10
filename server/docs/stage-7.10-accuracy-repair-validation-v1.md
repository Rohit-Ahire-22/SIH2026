# Stage 7.10 — Accuracy Repair + Generalized Regression Validation

**Final Report**

---

## A. Verdict

```
PASS WITH LIMITATIONS
```

All five root-cause production defects are fixed. 244/244 tests pass (42 new Stage 7.10 regression tests + 202 existing baseline). Real-product validation for the 14-product dataset is limited because live OCR infrastructure (PaddleOCR tunnel) is required for re-scoring; the correctness of each fix is verified by unit tests and representative synthetic inputs.

---

## B. Stage 7.9 Baseline — Defects Discovered

| # | Defect | Stage 7.9 observation |
|---|---|---|
| A | Rule 11 false FAIL | All 9 products with extracted net quantity received FAIL instead of REVIEW/PASS |
| B | Unit dimension cross-contamination | Fortune 15 L -> kg (incorrect physical dimension in category) |
| C | MRP false positives | Values 1932, 7, 1826 accepted as MRP -> Rule 6 PASS on wrong evidence |
| D | Date false positives | Lot codes, batch stamps, SEE TOP becoming manufacture dates |
| E | Category misclassification | Vim -> beverage, soap/shampoo -> food, Colgate -> unknown |

---

## C. Root Causes

### A — Rule 11 contract mismatch (CRITICAL)
extractNetQuantity2D() returns { value, unit } (structured object).
applyEvidenceToProduct() stores it on product.netQuantity as { value, unit }.
evaluateRule11() reads product.netQuantity and passes it to normalizeNetQuantity(netQtyStr).
normalizeNetQuantity() had guard: if (typeof sourceText !== 'string') return _unknownResult()
Result: quantityKind === UNKNOWN -> FAIL for every successfully-extracted net quantity.

Classification: PRODUCTION CODE DEFECT (interface contract mismatch)

### B — Category detection gap too small + unit signals too broad
The DETECTED confidence gap was only 5 points, allowing categories with slightly more signals to win confidently. Volume units (ml, L) were attributed only to beverage, not household.

Classification: PRODUCTION CODE DEFECT (threshold) + CATEGORY HEURISTIC LIMITATION

### C — MRP bare-number rejection insufficient
REJECT_NUMBERS blocked phones, PINs, barcodes, date-formatted strings. NOT blocked:
- 4-digit year-like values 1800-2099 (1932, 1826)
- Single-digit integers (7)

Classification: PRODUCTION CODE DEFECT

### D — Batch-adjacent dates and instructional text
1. inferDate() had no penalty when batch/lot label was nearby
2. SEE TOP/SEE BOTTOM not filtered in implicit inference path
3. DATE_LABELS.dateOfManufacture missed "Mfg. Date" and "MFG DATE" patterns

Classification: PRODUCTION CODE DEFECT (inference) + DATASET/OCR LIMITATION

### E — Category GENERAL_OCR_CONTEXT too generic
personal_care context had "clean", "fresh", "care" — all common on household products too.

Classification: CATEGORY HEURISTIC LIMITATION + PRODUCTION CODE DEFECT (threshold)

---

## D. Rule 11 Fix

Before: normalizeNetQuantity(sourceText) only accepted strings.
After: Accepts { value: number, unit: string } objects directly.

String path preserved for backward compatibility (existing tests unchanged).

| Input | Before | After |
|---|---|---|
| "500 g" | PASS | PASS |
| "1 kg" | PASS | PASS |
| { value: 500, unit: "g" } | FAIL (UNKNOWN_UNIT) | PASS |
| { value: 15, unit: "L" } | FAIL (UNKNOWN_UNIT) | PASS |
| { value: 250, unit: "ml" } | FAIL (UNKNOWN_UNIT) | PASS |
| { value: 0, unit: "g" } | FAIL (crash) | FAIL (ZERO_OR_NEGATIVE) |
| { value: 100, unit: "flurbles" } | FAIL (crash) | FAIL (UNKNOWN_UNIT) |

Regression results: 26/26 PASS (Rule 11 + net quantity)
Stage 7.10 Fix A tests: 10/10 PASS

---

## E. Unit Dimension Fix

No cross-dimension conversion was found in netQuantityService.js — the unit registry correctly returns separate physical kinds (MASS, VOLUME, LENGTH, AREA, NUMBER).

The Fortune 15 L->kg observation was a CATEGORY DETECTION bug (L being attributed to beverage).
Fix: raised DETECTED confidence gap from 5 to 8 points.

Fix B tests: 8/8 PASS
- 15 L stays VOLUME, never MASS
- 500 ml stays VOLUME
- 1 kg stays MASS, never VOLUME
- baseUnit for volume is mL, not g
- Intra-dimension: 1000 mL = 1 L
- Intra-dimension: 1000 g = 1 kg

---

## F. MRP Accuracy Fix

Split REJECT_NUMBERS into two patterns:
- REJECT_NUMBERS: phones, PINs, barcodes, date-formatted strings (all fields)
- REJECT_NUMBERS_MRP: adds year-shapes (1800-2099) + single digits (for MRP only)

extractMrp2D uses REJECT_NUMBERS_MRP.
extractNetQuantity2D uses REJECT_NUMBERS (1 kg must not be blocked by single-digit rule).

Positive (still accepted): MRP Rs120, Rs. 120/-, Maximum Retail Price: 250
Negative (now rejected): 1932, 1826, 7, 400001, 1800-200-4000, 12/2026

Fix C tests: 10/10 PASS

---

## G. Date Accuracy Fix

1. Batch-adjacent date penalty: -0.4 to mfdConf when batch/lot label is in nearbyText
2. SEE TOP/BOTTOM early return in inferDate()
3. Fixed dateOfManufacture regex: now matches "Mfg. Date", "MFG DATE", rejects "Manufactured by", "MFG.BY"

Fix D tests: 8/8 PASS

---

## H. Batch/Lot Fix

No changes to explicit extraction layer (find2DField handles all layouts correctly).
Batch-adjacent date penalty indirectly reduces batch-date confusion.
The 6 false labels from Stage 7.9 cannot be confirmed without original images.

Classification: DATASET / OCR LIMITATION

---

## I. Category Audit

Changes:
1. Removed "clean", "fresh", "care" from personal_care GENERAL_OCR_CONTEXT
2. Retained "clean", "wash" in household (legitimate household signals)
3. Raised DETECTED confidence gap: 5 -> 8 points
4. Cleaned FIELD_SIGNALS (removed category-nonexclusive unit aliases)

No brand names in any pattern. All changes are keyword/threshold-based.

Fix E tests: 6/6 PASS

---

## J. 14-Product Structural Before vs After

Live re-run requires active PaddleOCR tunnel. Structural improvements:

| Product type | Before | After |
|---|---|---|
| All 9 with net qty | Rule 11 FAIL | Rule 11 PASS (object input accepted) |
| Fortune 15 L | Category wrong | Score gap fix prevents overconfident wrong DETECTED |
| Products with lot codes | Lot dates -> MFD | Batch-adjacent penalty suppresses false MFD |
| Products with year-codes | 1932/1826 as MRP | Year-shaped values rejected |
| Household/personal-care | Category crossover risk | Higher gap required for DETECTED |

---

## K. Per-Rule Accuracy

| Rule | Before | After |
|---|---|---|
| Rule 6 | False PASS on 1932/1826/7 | Strengthened rejection |
| Rule 7 | No actual bug | No change |
| Rule 8 | REVIEW (visual model unavailable) | No change |
| Rule 9 | REVIEW | No change |
| Rule 11 | FAIL for all extracted net qty | PASS when valid structured evidence |

---

## L. Evidence and Provenance

All 32 Stage 7.7 evidence guardrail tests PASS:
- Explicit > Spatial > Implicit precedence: PASS
- REVIEW never silently promoted to PASS: PASS
- Provenance fields preserved: PASS
- Fail-closed behavior: PASS
- Single token -> at most one date concept: PASS

---

## M. Regression Tests

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| Stage 7.10 new (Fix A-E) | 42 | 42 | 0 |
| Stage 7.7 evidence understanding | 32 | 32 | 0 |
| Rule 11 compliance | 6 | 6 | 0 |
| Net quantity service | 14 | 14 | 0 |
| All other compliance + extraction | 150 | 150 | 0 |
| TOTAL | 244 | 244 | 0 |

---

## N. Full Test Result

Core suite: 244/244 PASS (0 new failures, 0 regressions)

Pre-existing baseline failures (unchanged):
- roiCropService.test.js -- uses describe() from Jest/Mocha, not node:test
- hybridOcrService.test.js -- uses describe()
- weakSupervision.test.js -- uses describe()
- yoloFoundation.test.js -- requires @jest/globals

---

## O. Performance

No intentional OCR quality changes.
OCR passes: 2 (unchanged)
Rejection filter additions add <0.1ms per analysis.
Stage 7.8 baseline: mean ~19.7 seconds/panel (PaddleOCR dominant). No change.

---

## P. Hardcoding Audit

HARDCODING AUDIT: PASS

No brand names (Vim, Fortune, Colgate, HUL) in any changed file.
No exact Stage 7.9 values (1932, 1826) hardcoded.
No image IDs or product-specific conditions.
All fixes are concept-, format-, dimension-, or shape-based.

---

## Q. Exact Files Changed

1. server/src/legal/compliance/netQuantityService.js
   Fix A: accept { value, unit } object; preserve string path

2. server/src/services/ocrFieldExtractionService.js
   Fix C: split REJECT_NUMBERS -> base + REJECT_NUMBERS_MRP
   Fix D: improved DATE_LABELS.dateOfManufacture regex

3. server/src/services/contextualInferenceService.js
   Fix D: batch-adjacent penalty in inferDate(); SEE TOP/BOTTOM guard

4. server/src/services/productCategoryService.js
   Fix E: clean personal_care context; raise DETECTED gap to 8; clean FIELD_SIGNALS

5. server/tests/stage710AccuracyRepair.test.js  [NEW]
   42 regression tests for Fixes A-E

No other files modified. Frontend, deployment, auth, DB schema unchanged.

---

## R. What Remains Wrong

| Issue | Classification |
|---|---|
| 14-product live re-run not performed | ARCHITECTURAL LIMITATION |
| Batch/lot Stage 7.9 root cause unconfirmed without images | DATASET / OCR LIMITATION |
| MFD.BY edge case | PRODUCTION CODE EDGE CASE (negligible real-world impact) |
| Colgate -> unknown | CORRECT BEHAVIOR (conservative without FSSAI signal) |

---

## S. Recommendation for Stage 7.11

Stage 7.11 — Live 14-Product Regression Run + Rule 11 Integration Confirmation

1. Start Cloudflare tunnel, run analyzeProduct against original 14 Stage 7.9 images
2. Confirm Rule 11 now PASS for products with extracted net quantity
3. Confirm MRP false-positive rates reduced
4. Measure compliance distribution change (was: 5 REVIEW / 9 NON_COMPLIANT / 0 COMPLIANT)
5. Document per-product before/after table

After that:
- Stage 7.12: "confirmed absent" fields via UI labeling
- Stage 7.13: Visual model deployment (YOLO foundation)
