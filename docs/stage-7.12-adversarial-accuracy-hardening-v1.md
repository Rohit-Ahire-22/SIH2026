# Stage 7.12 — Adversarial Accuracy & False-Positive Hardening (v1)

Product: SIH26034 — Legal Metrology (Packaged Commodities) Rules, 2011 compliance engine.

---

## 1. Verdict

**PASS WITH LIMITATIONS**

All ten documented Stage 7.11 defects were reproduced, root-caused, and fixed with generalised
(no product-specific) rules. The live 14-product re-run is strictly better or unchanged on every
field, all products remain fail-closed `REVIEW`, zero new false positives, and no regression in the
existing suites (511 `node:test` tests → 496 pass / 15 fail, where the 15 are the unchanged,
pre-existing training-infra / Jest-style baseline). Limitations are unchanged from prior stages:
the OCR-plus-heuristic pipeline is evidence-only (visual model missing keeps Rule 7/8 REVIEW), and
unit-quantity truth depends on OCR text quality (documented case: product_012's 15 kg is an OCR
misread of "15 L").

---

## 2. Summary

Stage 7.12 hardens the generalised evidence-first extraction pipeline against adversarial OCR and
competing numeric candidates after the Stage 7.11 live validation flagged ten defects across four
field classes:

- **MRP** — fabricated `₹7` (Dettol 010) instead of the genuine `₹129/-`; a 9-digit SKU
  (`MRPRs A 013000101`) read as `₹13000101` (008); a registered-licence fragment (`BO-13-`) read as
  `₹13` (020).
- **Dates** — a money value (`Rs.5.00`) read as an expiry `2000-05-01` (004); "Manufactured&Marketed
  by" anchoring a manufacture date `2025-01-01` (017); a toll-free number (`1800-10-22-221`) read as
  MFD `2022-10-01` (020); one OCR token duplicated under both "Pkd." and "Use By" producing
  `dop == expiry == 2026-07-28` (017).
- **Batch/Lot** — six false lots grabbed from the label token following "batch/lot" in OCR-merged
  text (003 `INDICATES`, 007 `Pkd`, 008 `Pkd`, 009 `M.R.P.Incl`, 011 `MFG.DATE`, 017 `and`).
- **Unit-safety** — density / unit-price shapes ("0.61/ml", "0.50g/ml") must never become net
  quantities; mass (`kg`) and volume (`L`) kinds must never cross-convert.

Fix families (all generalised, see §7–§8):

1. Strict rupee slash-notation (`/` must be followed by a dash; `7/25`, `13-`, `0.61/ml` rejected).
2. MRP reject widening: 7–11 digit licence/SKU shaped values are never an MRP.
3. `inferMrp` vets money-formatted tokens on the isolated amount (a barcode in the same OCR node
   no longer collateral-rejects the genuine `129/-`).
4. Bare-number MRP candidates are capped to exactly REVIEW (never PASS).
5. Cross-node candidate competition: competing implicit values resolve to REVIEW, never a guess.
6. Date parser guards: money-prefix and digit-run+separator tails rejected (dead "Rs.5.00",
   "1800-10-22", "33-01-2025" shapes).
7. Date labels: "Manufactured&Marketed by", "Manufactured by", "Mfg. by", "MFD. BY" can never anchor
   an MFD date; explicit manufacture-date forms still match.
8. Downgrade-only date-chain reconciliation: `expiry < mfd` or `expiry <= pack-date` (including
   token duplication) → both dates REVIEW, never a confident contradictory set.
9. Batch value validation: prose/label tokens, phone shapes, quantity shapes, and short numeric
   counts rejected; real codes (`ABC123`, `33-01-2025`, `BM5858`, `2424306`) preserved.
10. Net-quantity density/unit-price rejection.

Live results: the four false dates are gone, the six false lots are gone (017 recovers its real
lot `BM5858`), 010 now correctly reports `₹129`, 008 reports `₹30` (real label value; the SKU
`13000101` is rejected). All 14 products remain `REVIEW` (fail-closed). No new OCR passes.

---

## 3. Environment

| Item | Value |
|---|---|
| Working copy | `C:\Users\rsahi\OneDrive\Desktop\SIH` |
| OS / shell | win32 / PowerShell 5.1 |
| Node | v22.20.0 (ESM, `node:test`) |
| AI service | `http://127.0.0.1:8000` (`X-AI-Service-Key` from `server/.env`) — `/health` OK |
| Backend | `http://localhost:5000/api/health` → `{"success":true,"database":"connected"}` |
| Visual model | `/visual/detect` → `UNAVAILABLE_MODEL_MISSING` (unchanged; Rules 7/8 stay REVIEW) |
| Image viewing | NOT used (ground truth from pipeline OCR evidence only; nothing fabricated) |

---

## 4. Validation Methodology

1. **Reproduce before touching code** — every Stage 7.11 defect was replayed from the saved
   evidence strings in `%TEMP%\opencode\stage711_results.json` plus full code tracing of
   `ocrFieldExtractionService.js`, `contextualInferenceService.js`, `declarationConceptService.js`,
   `analysisOrchestrationService.js` (no OCR re-run needed for diagnosis).
2. **Generalised fixes only** — no product id, no product name, no fixed value in executable code
   (audit in §16).
3. **Synthetic verification** — 44 ad-hoc checks then a committed 42-test suite
   `server/tests/stage712AdversarialAccuracy.test.js` grounded in the real evidence strings.
4. **Live re-run** — the identical Stage 7.10/7.11 harness
   (`%TEMP%\opencode\stage79_full_pipeline.mjs`) re-ran the same 14 back panels against the
   changed extraction code; results stored in `%TEMP%\opencode\stage712_results.json`.
5. **Field-level diff** — 7.11 vs 7.12 for all six declaration fields (MRP, net quantity, batch,
   MFD, pack date, expiry) plus category and statuses (§10).
6. **Compliance/unit audit** — per-rule statuses and `normalizeNetQuantity` typing (§11–§12).
7. **Regression** — full `node --test server/tests/**/*.test.js` → 511 tests (496 pass / 15
   pre-existing baseline fails, set unchanged) and all focused suites green.
8. **Performance audit** — timing capture proving no new OCR passes (§15).

---

## 5. Test Corpus (14 products, back panels — unchanged from Stage 7.11)

`product_002, product_003, product_004, product_007, product_008, product_009, product_010,
product_011, product_012, product_013, product_014, product_015, product_017, product_020`
from `dataset/raw/proprietary/` (real Indian retail back panels, 1200×1600, OCR-run only).

---

## 6. Defects Targeted (Stage 7.11 residual)

| # | Product | Field (7.11) | Wrong value | Root cause class |
|---|---|---|---|---|
| D1 | 010 | mrp | 7 (true: 129) | Loose slash money + barcode collateral rejection of the real amount |
| D2 | 008 | mrp | 13000101 | 9-digit SKU captured by money pattern; no 7–11 reject |
| D3 | 020 | mrp | 13 (REVIEW) | Trailing-hyphen registration fragment (`BO-13-`) |
| D4 | 004 | expiry | 2000-05-01 | Money value (`Rs.5.00`) parsed as month-year date |
| D5 | 017 | mfd | 2025-01-01 | "Manufactured&Marketed by" matched as MFD label |
| D6 | 020 | mfd | 2022-10-01 | Toll-free number (`1800-10-22-221`) parsed as date |
| D7 | 017 | pkd & expiry | both 2026-07-28 | One OCR token duplicated under two anchors |
| D8 | 003 | batch | INDICATES | Prose word after "indicates the batch" |
| D8 | 007 | batch | Pkd | Next label captured as the lot value |
| D8 | 008 | batch | Pkd | Next label captured as the lot value |
| D8 | 009 | batch | M.R.P.Incl | Next label captured as the lot value |
| D8 | 011 | batch | MFG.DATE | Next label captured as the lot value |
| D8 | 017 | batch | and | Divider word after "Lot No." |
| D9 | 012 | netQuantity | 15 kg (true: 15 L) | OCR misread — NOT a code conversion error (documented as-is) |
| D10 | 004 | netQuantity 20 g | correct | Confirmed correct; no change |

---

## 7. Root-Cause Trace & Fix Mapping

Every fix is a SHAPE rule (not a product rule), anchored to the exact saved evidence line.

| Root cause (evidence) | Changed code | Result |
|---|---|---|
| `07/25` (MM/YY) & `13-` (hyphen reg no) matched `\s*[/-]` money | `classifyMrpValue`: slash form now requires `/` + `-` (`\s*\/\s*-`) | Only `7/-`, `129/-` etc. are money; `07/25`, `13-`, `0.61/ml` are not |
| `013000101` (9-digit SKU) in `MRPRs A 013000101` | `REJECT_NUMBERS_MRP` gains `^\d{7,11}$` | SKU can never be an MRP; years/PIN/phone/GTIN rejects unchanged |
| Barcode `8901396602491` in the same node as `129/-` | `inferMrp` shape-checks only `String(parsed.value)` for money tokens | Real amount survives (Stage test MP9) |
| Implicit bare `7` near `MRP.` reaching PASS | Bare numbers capped to `REVIEW_THRESHOLD` (+`bare_number_capped_review`) | Single-digit bare can only REVIEW; `7/-` stays valid money |
| `₹7` vs `129/-` in different nodes silently overwriting by scan order | Cross-node competition in `extractImplicitDeclarations` (`resolveCandidateCompetition`) | Margin < 0.15 → REVIEW + candidate-audit signals; money-format preferred on ties |
| `Rs.5.00 (INCL.OF ALL TAXES)` parsed as May-2000 | `parseDate`: `isMoneyPrefixedDate` + scan-all guards | `USE BY: NFD: Rs.5.00…` → no expiry |
| `1800-10-22-221`, `33-01-2025` parsed as dates | `parseDate`: `precededByDigitRun` (digit-run + separator tail) | Toll-free and code shapes are not dates; `MFD. 28-08-2026`, `USE BY: 08/2026`, `MFD: 08/2026` still parse |
| `Manufactured&Marketed by`, `Manufactured by`, `Mfg. by` matched MFD | `DATE_LABELS.dateOfManufacture` requires explicit `date`/`on`/`mfg date` forms; `MFD. BY` blocked (`mfd\.?(?!\.?\s*by\b)`) | Only genuine MFD labels anchor; manufacturer extraction untouched |
| `dop == expiry` from duplicated token | `reconcileDateRelationships` (downgrade-only, mutates `explicit` AND `evidenceMap`) | Both dates REVIEW + `date_relationship_conflict_downgraded` |
| `INDICATES`, `Pkd`, `M.R.P.Incl`, `MFG.DATE`, `and` as lot values | `isPlausibleBatchCode` (prose tokens, phone, quantity, short-numeric rejects) | All six cleared; real codes (`BM5858`, `ABC123`, `33-01-2025`, `2424306`) preserved |
| `0.61/ml`, `0.50g/ml` as quantities | `inferNetQuantity`: density/unit-price reject | Never a net quantity |

---

## 8. Code Changes (exact files & functions)

| File | Function / constant | Change |
|---|---|---|
| `server/src/services/declarationConceptService.js` | `classifyMrpValue` | Strict slash-notation (`/` + `-`); `slashNotation` narrowed |
| `server/src/services/ocrFieldExtractionService.js` | `REJECT_NUMBERS_MRP` | Added `^\d{7,11}$` |
| `server/src/services/ocrFieldExtractionService.js` | `DATE_LABELS.dateOfManufacture` | Explicit-form requirement; `MFD. BY` blocked |
| `server/src/services/ocrFieldExtractionService.js` | `parseDate`, `isMoneyPrefixedDate`, `precededByDigitRun` | Scan-all with money-prefix & digit-run guards |
| `server/src/services/ocrFieldExtractionService.js` | `BATCH_PROSE_PATTERN`, `BATCH_QUANTITY_PATTERN`, `BATCH_PHONE_PATTERN`, `isPlausibleBatchCode` | Batch value validation |
| `server/src/services/ocrFieldExtractionService.js` | `extractImplicitDeclarations` (+`COMPETITION_AMBIGUITY_MARGIN`, `resolveCandidateCompetition`) | Pooled cross-node candidates; per-node single-fill preserved |
| `server/src/services/ocrFieldExtractionService.js` | `reconcileDateRelationships` (called in `extractEvidence` after merge) | Downgrade-only date-chain reconciliation |
| `server/src/services/contextualInferenceService.js` | `inferMrp` | Isolated-amount shape check; bare-cap REVIEW; `nearby_money_candidate` signal |
| `server/src/services/contextualInferenceService.js` | `inferNetQuantity` | Density / unit-price rejection |
| `server/tests/stage712AdversarialAccuracy.test.js` | new | 42 tests (MP/DT/LT/XF/UN/CT) |

Unchanged: `netQuantityService.js`, `evidenceFusionService.js`, `analysisOrchestrationService.js`
and every compliance service (`applyEvidenceToProduct` contract preserved exactly).

---

## 9. Stage 7.12 Live Results (14 products, this stage)

All 14 overall = **REVIEW** (`rule6` REVIEW, `rule789` REVIEW, `rule11` REVIEW). Extracted fields:

| Product | mrp | netQuantity | batch | mfd | pkd | expiry |
|---|---|---|---|---|---|---|
| 002 | 115 | – | – | – | – | – |
| 003 | 90 | 70 g | – | – | – | – |
| 004 | – | 20 g | – | – | – | – |
| 007 | – | – | – | – | – | – |
| 008 | 30 | 10 kg | – | – | – | – |
| 009 | – | 42 g | – | – | – | – |
| 010 | 129 | (210 ml REVIEW, not written) | – | – | – | – |
| 011 | – | 200 g | – | – | – | – |
| 012 | – | 15 kg | – | – | – | – |
| 013 | – | – | – | – | – | – |
| 014 | 20 | 155 ml | – | – | – | – |
| 015 | – | 125 g | – | – | – | – |
| 017 | 399 | 1 kg | BM5858 | – | – | – |
| 020 | – | (360 ml REVIEW, not written) | – | – | – | – |

`–` = absent (REVIEW/missing in the evidence layer too, or explicitly read back as REVIEW-declared).

---

## 10. Before/After: Stage 7.11 vs Stage 7.12 (field-level diff)

| Product | Field | Stage 7.11 | Stage 7.12 | Delta |
|---|---|---|---|---|
| 003 | batch | INDICATES | – | FALSE-POSITIVE REMOVED |
| 004 | expiry | 2000-05-01 | – | FALSE-POSITIVE REMOVED |
| 007 | batch | Pkd | – | FALSE-POSITIVE REMOVED |
| 008 | mrp | – | 30 | VALUE RECOVERED (real label MRP) |
| 008 | batch | Pkd | – | FALSE-POSITIVE REMOVED |
| 009 | batch | M.R.P.Incl | – | FALSE-POSITIVE REMOVED |
| 010 | mrp | 7 | 129 | FALSE-POSITIVE REMOVED, TRUE MRP RECOVERED |
| 011 | batch | MFG.DATE | – | FALSE-POSITIVE REMOVED |
| 017 | batch | and | BM5858 | FALSE-POSITIVE REMOVED, TRUE LOT RECOVERED |
| 017 | mfd | 2025-01-01 | – | FALSE-POSITIVE REMOVED |
| 017 | pkd | 2026-07-28 | – | TOKEN-DUPLICATION CLEARED (both REVIEW) |
| 017 | expiry | 2026-07-28 | – | TOKEN-DUPLICATION CLEARED (both REVIEW) |
| 020 | mfd | 2022-10-01 | – | FALSE-POSITIVE REMOVED |
| 020 | mrp (REVIEW) | 13 | – | FALSE-POSITIVE REMOVED |

Unchanged and correct: 002 mrp 115; 003/004/009/011/012/015/017 net quantities; 012's 15 kg
(OCR misread of the true 15 L — documented); 004's 20 g implicit; all categories.

---

## 11. Rule 6 / 789 / 11 & Overall Compliance Matrix

| Product | r6 | r789 | r11 | Overall | Category |
|---|---|---|---|---|---|
| 002 | REVIEW | REVIEW | REVIEW | REVIEW | household (DETECTED) |
| 003 | REVIEW | REVIEW | REVIEW | REVIEW | food (DETECTED) |
| 004 | REVIEW | REVIEW | REVIEW | REVIEW | food (DETECTED) |
| 007 | REVIEW | REVIEW | REVIEW | REVIEW | food (REVIEW) |
| 008 | REVIEW | REVIEW | REVIEW | REVIEW | food (DETECTED) |
| 009 | REVIEW | REVIEW | REVIEW | REVIEW | unknown (UNKNOWN) |
| 010 | REVIEW | REVIEW | REVIEW | REVIEW | household (REVIEW) |
| 011 | REVIEW | REVIEW | REVIEW | REVIEW | food (DETECTED) |
| 012 | REVIEW | REVIEW | REVIEW | REVIEW | food (REVIEW) |
| 013 | REVIEW | REVIEW | REVIEW | REVIEW | food (DETECTED) |
| 014 | REVIEW | REVIEW | REVIEW | REVIEW | beverage (REVIEW) |
| 015 | REVIEW | REVIEW | REVIEW | REVIEW | food (REVIEW) |
| 017 | REVIEW | REVIEW | REVIEW | REVIEW | food (DETECTED) |
| 020 | REVIEW | REVIEW | REVIEW | REVIEW | food (REVIEW) |

No product became COMPLIANT or NON_COMPLIANT in either stage. Rule 7/8 remain REVIEW (visual
model unavailable). Fail-closed discipline preserved end-to-end.

---

## 12. Unit-Safety & Net-Quantity Audit

Every declared net quantity normalises without `UNKNOWN_UNIT` (0/14) and with a correct kind:

| Product | Declared | Normalized | Kind |
|---|---|---|---|
| 003 | 70 g | 70 g | MASS |
| 004 | 20 g | 20 g | MASS |
| 008 | 10 kg | 10000 g | MASS |
| 009 | 42 g | 42 g | MASS |
| 010 | 210 ml (REVIEW) | 210 mL | VOLUME |
| 011 | 200 g | 200 g | MASS |
| 012 | 15 kg | 15000 g | MASS |
| 014 | 155 ml | 155 mL | VOLUME |
| 015 | 125 g | 125 g | MASS |
| 017 | 1 kg | 1000 g | MASS |
| 020 | 360 ml (REVIEW) | 360 mL | VOLUME |

Density / unit-price shapes are now rejected before they become candidates (`0.61/ml`,
`0.50g/ml`). `kg` (MASS) and `L` (VOLUME) are never cross-converted (kind barrier preserved).
010's `210 ml` and 020's `360 ml` are implicit REVIEW candidates that are NOT written to product
fields (evidence-only noise, fail-closed).

---

## 13. Test Suite

New: `server/tests/stage712AdversarialAccuracy.test.js` — **42 tests, all passing** across
MP (money strictness / rejects / isolated-amount barcode / bare cap), DT (money-as-date,
toll-free-as-date, code-shape dates, label disambiguation, date-chain reconciliation), LT
(prose/phone/quantity/short-numeric lot negatives, valid codes preserved), XF (competition →
REVIEW + candidate audit signals; lone confident value untouched), UN (density shapes, kg≠L
kind barrier), CT (one value → one meaning; full declaration line).

Focused regression (all green): stage710AccuracyRepair 42/42, evidenceUnderstanding 32/32,
ocrFieldExtraction, ocrSpatialExtraction, spatialExtraction, measurementEvidence, evidenceFusion.

Full `node:test` sweep: 511 tests → **496 pass / 15 fail** — identical failure set to the
Stage 7.11 baseline (unchanged pre-existing failures; see §14).

---

## 14. Failing Test Breakdown (known baseline, unchanged)

The 15 failures are pre-existing and unrelated to extraction/compliance:

- **Jest-style files** that cannot run under `node:test` (`describe` undefined):
  `datasetScaling`, `hybridOcrService`, `logoVendorIngestion`-class suites, `ocrPreprocessing`,
  `proprietaryBaseline`, `proprietaryDatasetIngestion`, `roiCropService`, `weakSupervision`,
  `yoloFoundation`.
- **Training/model-registry API drift**: `modelRegistry.evaluateAndPromote is not a function` /
  `registryService.evaluateAndPromote is not a function` in `continuousLearning`,
  `continuousLearningInfrastructure`, `productHistory`.

None of these import the three files changed in Stage 7.12 (verified by import grep). Count and
set are identical to the recorded Stage 7.11 full-run baseline.

---

## 15. Performance (no new OCR passes)

14-product run, identical harness, same local AI:

| Metric | Stage 7.11 | Stage 7.12 |
|---|---|---|
| Total pipeline (sum of 14) | 285.7 s | 283.6 s |
| Hybrid OCR share | 99.9 % | 99.9 % |
| Extraction phase | ms-scale | ms-scale (118 ms total) |
| Visual / measurement / category / rules | ms-scale | ms-scale |

No new OCR passes were added (OCR call count per product unchanged: full image + up to 3 ROI
crops + visual detection which is unavailable). Extraction CPU impact is negligible (regex-level).

---

## 16. Hardcoding Audit & Stop-Condition Audit

- **Hardcoding audit**: no product id, product name, MRP value, lot code, or evidence literal
  appears in executable code. All defect values (`129`, `7`, `07/25`, `013000101`, `BM5858`,
  `1800-10-22`, `Rs.5.00`, `M.R.P.Incl`, `33-01-2025`, `2424306`) appear only in comments and
  test fixtures. Verified by source grep (all hits are comments).
- **Stop-condition audit**: objective — generalised adversarial hardening + 17-section report,
  then STOP. Scope respected: no commits, no pushes, no frontend/deployment work, no YOLO/training
  work, no extra OCR passes, no product-specific rules, no legal-threshold changes, no artificial
  COMPLIANT. Visual-delivery limitation (Rules 7/8) is unchanged and disclosed, not worked around.

---

## 17. Evidence / Trace Files & Stage 7.13 Recommendation

| Artifact | Path |
|---|---|
| Stage 7.12 live results | `%TEMP%\opencode\stage712_results.json` |
| Stage 7.11 results (before) | `%TEMP%\opencode\stage711_results.json` |
| Harness (unchanged) | `%TEMP%\opencode\stage79_full_pipeline.mjs` |
| Stage 7.12 test suite | `server/tests/stage712AdversarialAccuracy.test.js` |
| This report | `docs/stage-7.12-adversarial-accuracy-hardening-v1.md` |
| Prior reports | `docs/stage-7.11-live-14-product-validation-v1.md`, `docs/multi-product-generalization-validation-v1.md` |

**Recommendation for Stage 7.13**: (a) restore the visual/detection model so Rule 7/8 can exit
REVIEW; (b) add a lightweight unit-price/density structure (`₹8.5/100g`, `0.61/ml`) to the
metadata layer so repeat measurements can be correlated without entering the declaration fields;
(c) consider a calibration-image (ruler-on-pack) capture path and reference-test intent to let the
012-class OCR ambiguity ("15L" read as "15kg") be arbitrated by measurement evidence rather than a
code heuristic.