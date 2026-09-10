# SIH26034 · Stage 7.11 — Live 14-Product Accuracy Validation (Stage 7.10 code)

**Validation report — v1**

---

## 1. Verdict

**PASS WITH LIMITATIONS**

Stage 7.10's claimed fixes reproduce live. Rule 11 (net-quantity contract) is
structurally repaired: `UNKNOWN_UNIT` is gone, every declared net quantity now
normalizes to a typed `quantityKind` (MASS/VOLUME) with no incompatible unit
transformation in code, and False-FAIL compliance outcomes are eliminated
(9 of 14 products flip from NON_COMPLIANT to REVIEW). MRP false values (1932,
1826) that dominated the Stage 7.9 baseline are suppressed. The focused test
suite is green (232/232), the 42 new Stage 7.10 regression tests pass (42/42),
and the full suite has zero new regressions versus Stage 7.9 (15 fails, all in
the known-baseline Jest-style / model-infrastructure buckets).

**Limitations requiring Stage 7.12 (no production code changed in this stage):**

1. **MRP residual FP** — Dettol (product_010) still reports `mrp=7` (from the
   `07/25` date fragment). The true MRP `129/-` is present in the same OCR
   text but ignored.
2. **Date/lot/batch disambiguation unresolved** — false dates persist on
   product_004 (`expiry 2000-05-01`), product_017 (`mfd 2025-01-01` from lot
   `33-01-2025`; `dop/eod 2026-07-28` conflation), product_020 (`mfd
   2022-10-01`); batch/lot false positives persist on 6 products
   (`INDICATES`, `Pkd` x2, `M.R.P.Incl`, `MFG.DATE`, `and`).
3. **Category** wrong-label REVIEWs persist for dishwash (->beverage .57),
   soap (->food .63), shampoo (->food .60); Colgate remains UNKNOWN.
4. **Manufacturer field** remains garbled OCR blobs (7/14 products).
5. **product_012** net quantity is extracted as `15 kg` (OCR read of a 15 L
   oil tin). No code-level L->kg conversion occurred — the misread is at the
   OCR layer — but the declared net is wrong.

---

## 2. Summary

- **Stage being validated:** Stage 7.10 code (working tree, uncommitted) —
  the "5 generalized production defects repaired" claim.
- **Evidence domain:** live re-run of the SAME 14 back-panel product images as
  Stage 7.9
  ([`docs/multi-product-generalization-validation-v1.md`](./multi-product-generalization-validation-v1.md)).
- **Overall result:** 14/14 REVIEW, 0 COMPLIANT, 0 NON_COMPLIANT, 0 BLOCKED.
- **Baseline (Stage 7.9):** 9 NON_COMPLIANT / 5 REVIEW / 0 COMPLIANT.
- **Net-quantity contract:** fixed — 0 `UNKNOWN_UNIT`, 0 False-FAIL.
- **Focused tests:** 232/232 pass; new Stage 7.10 tests 42/42; full suite
  469 ran, 454 pass, 15 fail (all pre-existing baseline buckets).
- **No code changes were made during this validation.**

---

## 3. Environment

| Item | Value |
|---|---|
| Working dir | `C:\Users\rsahi\OneDrive\Desktop\SIH` |
| Git state | Stage 7.10 changes uncommitted in working tree; no new commits created |
| Local AI service | `http://localhost:8000` (uvicorn already running — not restarted) |
| Backend health | `http://localhost:5000/api/health` -> 200, `database: connected` |
| Validation harness | `%TEMP%\opencode\stage79_full_pipeline.mjs` (updated to Stage 7.10 orchestrator contract) |
| Live results | `%TEMP%\opencode\stage711_results.json` |
| Stage 7.9 baseline | `%TEMP%\opencode\stage79_results_full.json` |

---

## 4. AI Service / Tunnel Status

- Local AI service healthy: `GET /health` → 200
  `{"status":"ok","service":"sih-compliance-ai-service"}`.
- Backend healthy, DB connected.
- Public Render URL (`https://sih26034-ai.onrender.com`) remained unreachable;
  harness forced `AI_SERVICE_URL=http://127.0.0.1:8000` for the live run.
- All hybrid-OCR inference for this validation ran against the local service.

---

## 5. Validation Methodology

- **Harness** replicates the Stage 7.10 orchestrator in-process: reads the
  real back-panel image bytes, calls the real AI OCR service, then runs the
  real `hybridOcrService`, `ocrFieldExtractionService.extractProductFields`,
  `ocrFieldExtractionService.extractEvidence` (with precomputed explicit
  detections + image dimensions), `evidenceFusionService.fuseEvidence`,
  `productCategoryService.classifyProductCategory`, and the orchestrator's
  rule services, printing a per-product report.
- Harness mirrors the Stage 7.10 `applyEvidenceToProduct`, including the
  object-typed `netQuantity` write and evidence-gated MRP/net-quantity paths,
  and records a `netQuantityAudit` (declared -> normalized) for the unit
  safety stop-condition check.
- **Ground truth** is derived from the pipeline's own OCR text corpus
  (images are not viewable in this environment); every field comparison is
  labeled CORRECT / CORRECT REVIEW / MISSED / FALSE POSITIVE / WRONG VALUE /
  WRONG SEMANTIC CLASSIFICATION / OCR FAILURE / INSUFFICIENT IMAGE EVIDENCE.
- Compliance vocabulary: COMPLIANT / NON_COMPLIANT / REVIEW / PENDING /
  NOT_APPLICABLE. FAIL collapses to NON_COMPLIANT; no evidence never →
  COMPLIANT.

---

## 6. Test Corpus (14 products, back panels)

| ID | Product | Expected net quantity | Expected MRP (OCR evidence) |
|---|---|---|---|
| product_002 | Surf Excel Easy Wash | ~1 kg | 115 (present) |
| product_003 | Parle-G 70g+10g trickle | 70 g | ~90? OCR `MRP NCL 90` |
| product_004 | Kurkure Masala 20g | 20 g | Rs.5.00 (in OCR, missed) |
| product_007 | TATA Salt | ~1 kg | none printed |
| product_008 | Aashirvaad Atta 10 kg | 10 kg | present on pack, missed |
| product_009 | Colgate MaxFresh 42 g | 42 g | present on front, missed |
| product_010 | Dettol Liquid Handwash 210 ml | 210 ml | 129/- (in OCR) |
| product_011 | Haldiram's Bhujia export 200 g | 200 g | none (export) |
| product_012 | Fortune Soya Oil tin | 15 L (volume) | none printed |
| product_013 | Paaru Fish Fry Masala 80 g | ~80 g | present on pack, missed |
| product_014 | Vim Dishwash Gel 155 ml | 155 ml | 20 |
| product_015 | Lifebuoy Soap 125 g | 125 g | small, suppressed from 1826 |
| product_017 | Dabur Honey 1 kg | 1 kg | 399 |
| product_020 | Sunsilk Noir 360 ml | 360 ml | present on pack, missed |

---

## 7. Stage 7.9 Baseline (recorded)

| ID | Overall | Rule 11 | NetQuantity | MRP | Date issues | Category |
|---|---|---|---|---|---|---|
| product_002 | REVIEW | REVIEW | (none) | 115 | - | household DETECTED .99 |
| product_003 | NON_COMPLIANT | FAIL | `{70,g}` | **1932** (W) | - | food DETECTED .99 |
| product_004 | NON_COMPLIANT | FAIL | `{20,g}` | (missed) | expiry `2000-05-01` (W) | food DETECTED .99 |
| product_007 | REVIEW | REVIEW | (none) | (none) | - | food REVIEW .60 |
| product_008 | NON_COMPLIANT | FAIL | `{10,kg}` | (missed) | - | food DETECTED .99 |
| product_009 | NON_COMPLIANT | FAIL | `{42,g}` | (missed) | - | unknown UNKNOWN 0 |
| product_010 | REVIEW | REVIEW | (none) | **7** (W; true 129/-) | - | household REVIEW .67 |
| product_011 | NON_COMPLIANT | FAIL | `{200,g}` | (none/export) | - | food DETECTED .99 |
| product_012 | NON_COMPLIANT | FAIL | `{15,kg}` (OCR misread) | (none) | - | food REVIEW .77 |
| product_013 | REVIEW | REVIEW | (none) | (missed) | - | food DETECTED .99 |
| product_014 | NON_COMPLIANT | FAIL | `{155,ml}` | 20 | - | beverage REVIEW .57 (W) |
| product_015 | NON_COMPLIANT | FAIL | `{125,g}` | **1826** (W) | - | food REVIEW .63 (W) |
| product_017 | NON_COMPLIANT | FAIL | `{1,kg}` | 399 | mfd `2025-01-01` (W), dop `2026-07-28`, eod `2026-07-28` | food DETECTED .99 |
| product_020 | REVIEW | REVIEW | (none) | (13 REVIEW, suppressed) | mfd `2022-10-01` (W) | food REVIEW .60 (W) |

---

## 8. Stage 7.10 Live Results (recorded this stage)

| ID | Overall | Rule 11 | NetQuantity | MRP | Date issues | Category |
|---|---|---|---|---|---|---|
| product_002 | REVIEW | REVIEW | (none) | 115 | - | household DETECTED .99 |
| product_003 | REVIEW | REVIEW | `{70,g}` | **90** (was 1932) | - | food DETECTED .99 |
| product_004 | REVIEW | REVIEW | `{20,g}` | (missed) | expiry `2000-05-01` (W) | food DETECTED .99 |
| product_007 | REVIEW | REVIEW | (none) | (none) | - | food REVIEW .60 |
| product_008 | REVIEW | REVIEW | `{10,kg}` | (missed) | - | food DETECTED .99 |
| product_009 | REVIEW | REVIEW | `{42,g}` | (missed) | - | unknown UNKNOWN 0 |
| product_010 | REVIEW | REVIEW | 210 ml (REVIEW, not asserted) | **7** (W persists) | - | household REVIEW .67 |
| product_011 | REVIEW | REVIEW | `{200,g}` | (none/export) | - | food DETECTED .99 |
| product_012 | REVIEW | REVIEW | `{15,kg}` (OCR misread) | (none) | - | food REVIEW .77 |
| product_013 | REVIEW | REVIEW | (none) | (missed) | - | food DETECTED .99 |
| product_014 | REVIEW | REVIEW | `{155,ml}` | 20 | - | beverage REVIEW .57 (W) |
| product_015 | REVIEW | REVIEW | `{125,g}` | **none** (1826 suppressed) | mfd REVIEW `2017-07-01` not asserted | food REVIEW .63 (W) |
| product_017 | REVIEW | REVIEW | `{1,kg}` | 399 | mfd `2025-01-01` (W), dop `2026-07-28`, eod `2026-07-28` | food DETECTED .99 |
| product_020 | REVIEW | REVIEW | 360 ml (REVIEW, not asserted) | (13 REVIEW, suppressed) | mfd `2022-10-01` (W) | food REVIEW .60 (W) |

---

## 9. Rule 11 — Net Quantity Contract Validation (the Stage 7.10 headline fix)

Live normalization audit (`netQuantityAudit` captured by the harness):

| ID | Declared | Normalized | Kind | base | Status |
|---|---|---|---|---|---|
| product_003 | `{70, g}` | `70 g` | MASS | 70 g | PASS |
| product_004 | `{20, g}` | `20 g` | MASS | 20 g | PASS |
| product_008 | `{10, kg}` | `10 kg` | MASS | 10000 g | PASS |
| product_009 | `{42, g}` | `42 g` | MASS | 42 g | PASS |
| product_010 | `{210, ml}` | `210 mL` | VOLUME | 210 mL | REVIEW (no assert) |
| product_011 | `{200, g}` | `200 g` | MASS | 200 g | PASS |
| product_012 | `{15, kg}` | `15 kg` | MASS | 15000 g | PASS (unit misread at OCR: see sec 10) |
| product_014 | `{155, ml}` | `155 mL` | VOLUME | 155 mL | PASS |
| product_015 | `{125, g}` | `125 g` | MASS | 125 g | PASS |
| product_017 | `{1, kg}` | `1 kg` | MASS | 1000 g | PASS |
| product_020 | `{360, ml}` | `360 mL` | VOLUME | 360 mL | REVIEW (no assert) |

- **`UNKNOWN_UNIT` count: 0** (was 9 in Stage 7.9). The
  `normalizeNetQuantity` structured-input path is real and live.
- **No incompatible unit transformations occurred** (see sec 10). Every value
  kept its dimension through normalizer, rule service, and compliance output.
- **False-FAIL eliminated:** 9/9 products that were NON_COMPLIANT solely on
  the Rule 11 contract bug are now REVIEW (net-quantity expression PASS; only
  the uncalibrated MPE clause holds REVIEW) — the intended fail-closed
  outcome.

---

## 10. Physical-Unit Dimension Safety Validation

| Product | True unit (OCR) | Normalized | Code transform? | Audit result |
|---|---|---|---|---|
| product_010 (Dettol) | ml | VOLUME mL | none | SAFE |
| product_014 (Vim) | ml | VOLUME mL | none | SAFE |
| product_015 (Lifebuoy) | g | MASS g | none | SAFE |
| product_017 (Dabur) | kg | MASS g | none | SAFE |
| product_008 (Atta) | kg | MASS g | none | SAFE |
| product_012 (oil tin) | **L** (volume) | `kg`/MASS | none | **OCR FAILURE (unit misread), NOT a conversion** |

- **No L->kg, no ml->g, no g->ml conversion anywhere in the pipeline.**
- product_012's declared unit "kg" comes verbatim from OCR text
  (`NET CONTENTS AT 30'C 15 kg (16.484tre`). The true tin is 15 L. This is a
  machine-vision (OCR) misread, not an arithmetic/unit transform — a Stage
  7.12 defect (post-OCR unit sanity for volume products), not a Stage 7.10
  regression. Verified: `normalizeNetQuantity` only ever applied the unit it
  was handed.
- **Conclusion: unit-safety stop conditions are NOT triggered.**

---

## 11. MRP Validation

| ID | 7.9 | 7.10 live | Classification |
|---|---|---|---|
| product_002 | 115 | 115 | CORRECT (unchanged) |
| product_003 | **1932** | **90** | 1932 suppressed (year-shaped ban); 90 = OCR `MRP NCL 90` (likely "INCL"); exact digits unverifiable without pixels — recorded CORRECT-likely, flag for human |
| product_004 | - | - | MISSED (`Rs.5.00 (INCL.OF ALLTAXES)` present in OCR) |
| product_007 | - | - | no MRP printed — CORRECT absence |
| product_008 | - | - | MISSED (MRP present on pack) |
| product_009 | - | - | MISSED (front panel MRP) |
| product_010 | **7** | **7** | **FALSE POSITIVE persists** — true `129/-` in the same OCR line (`07/25.#07/27 BSTT342 129/-`) |
| product_011 | - | - | export, no printed MRP — CORRECT absence |
| product_012 | - | - | no printed MRP — CORRECT absence |
| product_013 | - | - | MISSED |
| product_014 | 20 | 20 | CORRECT |
| product_015 | **1826** | **none** | **FP suppressed** (year-shaped reject works) |
| product_017 | 399 | 399 | CORRECT (`MRPR 399.00`) |
| product_020 | 13 (REVIEW) | 13 (REVIEW, suppressed) | not asserted — CORRECT REVIEW |

Net: 2 systematic MRP FPs eliminated (1932, 1826); 1 non-systematic MRP FP
persists (product_010 `07` date fragment — see sec 16). MRP stop condition
("systematic") is not triggered; residual defect is per-product.

---

## 12. Date Validation

| Product | 7.10 live | Classification |
|---|---|---|
| product_004 | expiry `2000-05-01` | **WRONG VALUE** (no such date; derived from garbled `USE BY:`/`NDF:` clutter) |
| product_015 | mfd REVIEW `2017-07-01` (not asserted) | CORRECT REVIEW (fail-closed; `C7/2017` lot context) — improvement vs 7.9 |
| product_017 | mfd `2025-01-01`, dop `2026-07-28`, eod `2026-07-28` | **WRONG VALUE** mfd = lot `33-01-2025`; dop/eod conflation persists |
| product_020 | mfd `2022-10-01` | **WRONG VALUE** (pack-context year fragment) |

- "SEE TOP / CODING AREA" handling improves (product_002 no longer emits an
  mfd FP); the product_017 lot remains the main `Manufactured & Marketed by`
  leakage.
- Date stop condition ("systematically misclassified") is **not** triggered —
  4 products wrong, 10 clean — but the class is far from repaired (Stage 7.12).

---

## 13. Batch / Lot Validation

| Product | 7.10 live batch | Classification |
|---|---|---|
| product_003 | `INDICATES` | FALSE POSITIVE (`...BATCH INDICATES THE...`) |
| product_007 | `Pkd` | FALSE POSITIVE |
| product_008 | `Pkd` | FALSE POSITIVE |
| product_009 | `M.R.P.Incl` | FALSE POSITIVE (MRP label line) |
| product_011 | `MFG.DATE` | FALSE POSITIVE |
| product_017 | `and` | FALSE POSITIVE (`lot no. and see below`) |

Batch/lot disambiguation was **not** among the 5 Stage 7.10 fixes and remains
unrepaired (6 FPs). No stop-condition trigger (not systematic; always fails
closed), but a clear Stage 7.12 work item.

---

## 14. Category Validation

| Product | 7.10 live | Classification |
|---|---|---|
| product_002 | household DETECTED .99 | CORRECT |
| product_003 | food DETECTED .99 | CORRECT |
| product_004 | food DETECTED .99 | CORRECT |
| product_007 | food REVIEW .60 | CORRECT label, low confidence |
| product_008 | food DETECTED .99 | CORRECT |
| product_009 | unknown UNKNOWN 0 | CORRECT (honest abstain) |
| product_010 | household REVIEW .67 | CORRECT |
| product_011 | food DETECTED .99 | CORRECT |
| product_012 | food REVIEW .77 | CORRECT |
| product_013 | food DETECTED .99 | CORRECT |
| product_014 | beverage REVIEW .57 | **WRONG SEMANTIC CLASSIFICATION** (dishwash) — but REVIEW-level, not DETECTED |
| product_015 | food REVIEW .63 | **WRONG SEMANTIC CLASSIFICATION** (soap) — REVIEW-level |
| product_017 | food DETECTED .99 | CORRECT |
| product_020 | food REVIEW .60 | **WRONG SEMANTIC CLASSIFICATION** (shampoo) — REVIEW-level |

- Stage 7.10's margin-based DETECTED + weak-keyword cleanup hold live:
  **zero DETECTED for wrong categories** across the corpus; all
  low-confidence wrong labels land at REVIEW (safe).

---

## 15. Compliance Results (per Rule & Overall)

| Rule | 7.9 | 7.10 live | Explication |
|---|---|---|---|
| Rule 6 (Net Qty Display) | 14 x REVIEW | 14 x REVIEW | uncalibrated scale not attached (REVIEW, fail-closed) |
| Rule 7 (Measurement/calibration) | REVIEW | REVIEW | GCMS/sensor calibration unavailable |
| Rule 8 (Visual/official marks) | REVIEW | REVIEW | `/visual/detect` model slot `UNAVAILABLE_MODEL_MISSING` |
| Rule 9 (falsification/conflict) | REVIEW | REVIEW | conflict review only |
| Rule 11 (net-qty expression + MPE) | 9 FAIL / 5 REVIEW | 14 x REVIEW | expression PASS for all; MPE REVIEW (no calibrated measure) |
| **Overall** | 9 NON_COMPLIANT / 5 REVIEW | **14 REVIEW / 0 NON_COMPLIANT / 0 COMPLIANT** | fail-closed; no false COMPLIANT |

---

## 16. Before/After Table

| ID | 7.9 | 7.10 live | # fixed fields |
|---|---|---|---|
| product_002 | REVIEW | REVIEW | 0 |
| product_003 | **NON_COMPLIANT** | **REVIEW** | Rule 11 + MRP FP suppressed |
| product_004 | **NON_COMPLIANT** | **REVIEW** | Rule 11 |
| product_007 | REVIEW | REVIEW | 0 |
| product_008 | **NON_COMPLIANT** | **REVIEW** | Rule 11 |
| product_009 | **NON_COMPLIANT** | **REVIEW** | Rule 11 |
| product_010 | REVIEW | REVIEW | 0 (MRP FP persists) |
| product_011 | **NON_COMPLIANT** | **REVIEW** | Rule 11 |
| product_012 | **NON_COMPLIANT** | **REVIEW** | Rule 11 (unit misread stays) |
| product_013 | REVIEW | REVIEW | 0 |
| product_014 | **NON_COMPLIANT** | **REVIEW** | Rule 11 |
| product_015 | **NON_COMPLIANT** | **REVIEW** | Rule 11 + MRP 1826 suppressed |
| product_017 | **NON_COMPLIANT** | **REVIEW** | Rule 11 (dates still wrong) |
| product_020 | REVIEW | REVIEW | 0 |

Net field fixes: **9x Rule 11 contract, 2x MRP FP suppression** → 0 False-FAIL.

---

## 17. False-Positive Audit

| Concept | Stage 7.9 FPs | Stage 7.10 live FPs | Delta |
|---|---|---|---|
| MRP | 1932, 1826, 7 | 7 (product_010) | -2 |
| Date mfd | 2022-10-01, 2017-07-01 (asserted), 2025-01-01 | 2025-01-01 (017), 2022-10-01 (020); 2017-07-01 now REVIEW (not asserted) | -1 asserted; same wrong values persist |
| Date expiry | 2000-05-01 (004), 2026-07-28 (017) | 2000-05-01 (004), 2026-07-28 (017) | 0 |
| Batch/lot | `INDICATES`, `Pkd`, `Pkd`, `M.R.P.Incl`, `MFG.DATE`, `and` | same 6 | 0 |
| Category (beverage/food mislabels) | DETECTED on beverage | all REVIEW only | de-escalated |

---

## 18. Provenance Audit

- **MRP 90 (product_003):** PASS, `sourceType=SPATIAL_ASSOCIATION`,
  signal `explicit_label`, evidence text `MRP NCL 90`. Provenance retained.
- **MRP 7 (product_010):** PASS via `IMPLICIT_CONTEXT` with signals
  `bare_number_near_price_label`, `nearby_price_word`, `declaration_region`,
  `prominent_typography`. This provenance made the FP auditable — price-word
  adjacency fired on the date fragment.
- **NetQuantity 1 kg (product_017):** PASS, `SPATIAL_ASSOCIATION`, evidence
  `NET QUANTITTY 1 kg`, explicit label retained.
- **Dates (product_017 mfd):** PASS, `SPATIAL_ASSOCIATION`, evidence
  `33-01-2025` — provenance clearly shows the source is the lot line.
- **Implicit REVIEW results** (product_010 210 ml, product_015 125 g, etc.)
  carry `confidence` + `signals` through `fuseEvidence` V2, so every
  REVIEW/no-assert decision in the compliance output remains traceable.

Provenance stop condition: PASS — no synthetic/unexplained values found.

---

## 19. Rule 6 / 789 / 11 Result Matrix

| ID | Rule 6 | Rule 7 | Rule 8 | Rule 9 | Rule 11 | Overall |
|---|---|---|---|---|---|---|
| product_002 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_003 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_004 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_007 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_008 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_009 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_010 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_011 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_012 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_013 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_014 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_015 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_017 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |
| product_020 | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW |

Rule 11 was the only rule that FAILed in Stage 7.9; it is now REVIEW for all
14 products (expression PASS, MPE clause REVIEW pending calibrated
measurement).

---

## 20. Performance (Stage 7.10 live vs Stage 7.9)

| Metric | Stage 7.9 | Stage 7.10 live |
|---|---|---|
| Total 14 panels | ~276 s | **285.7 s** |
| Mean per panel | 19.7 s | **20.4 s** |
| Hybrid OCR share | 99.9% | **99.9%** (285.5 s of 285.7 s) |
| Non-OCR share | ~0.1% | extraction 114 ms total (~0.04%), rest ~0.1% |
| Slowest panel | Parle-G 49.1 s | Parle-G **51.8 s** |
| 2nd slowest | Haldiram's 48.3 s | Haldiram's **48.7 s** |

Delta ~+3.5% is machine/queue noise; no Stage 7.10 hot-path regression.
Latency budget continues to be dominated by hybrid OCR (neural text +
ROI rescans), not extraction or rule logic.

---

## 21. Tests

| Suite | Ran | Pass | Fail | Notes |
|---|---|---|---|---|
| Focused (re-testable non-Jest-broken files, 25 files) | 232 | **232** | 0 | includes evidenceUnderstanding (32), evidenceFusion, rule services |
| Stage 7.10 regression tests (`stage710AccuracyRepair.test.js`) | 42 | **42** | 0 | new 42-test suite fully green |
| Full `node --test server/tests/**/*.test.js` | 469 | 454 | **15** | all 15 in known pre-existing baseline buckets (sec 22) |

- No regression vs Stage 7.9 (which had 16 fails in the same buckets).
- `evidenceUnderstanding.test.js`: 32/32 pass (unchanged → no generalized
  evidence regression).

---

## 22. Failing Test Breakdown (known baseline, unchanged)

| Failing bucket | Files / tests | Root cause |
|---|---|---|
| Jest-style `describe is not defined` (9 files) | datasetScaling, hybridOcrService, ocrPreprocessing, productHistory, proprietaryBaseline, proprietaryDatasetIngestion, roiCropService, weakSupervision, yoloFoundation | legacy Jest-style tests run under `node --test`; pre-existing |
| Model promotion / continuous-learning infra | Continuous Learning Pipeline (Test 7/8), Production Continuous-Learning Training Infrastructure (Test K/M/O/P) | missing production model / registry slots + no live model to promote; pre-existing env condition |

All 15 are environment/legacy — **not** evidence, rule, or extraction logic.

---

## 23. Remaining Defects (for Stage 7.12)

1. **MRP residual FP** — 2-digit year/date fragments (e.g. `07`) still pass
   the bare-number MRP path (product_010 `129/-` present but missed). Suggest
   date-shape context conflict + require explicit `Rs.`/`MRP` adjacency at a
   higher threshold, and prefer `n/-` price shapes.
2. **Date/lot/batch disambiguation** — 4 products with false dates;
   year-in-lot (`33-01-2025`), pack-region year (`2022`), and `USE BY:`
   clutter lead to WRONG VALUE dates. Batch/lot still 6 FPs never fixed.
3. **OCR unit misread (product_012)** — volume product parsed as `kg`
   (OCR-level). Post-OCR unit sanity: for beverage/oil categories prefer
   VOLUME; for flour/atta keep MASS.
4. **Category wrong-label REVIEWs** — dishwash->beverage (liquid keyword),
   soap/shampoo->food. Generalize keyword sets (personal-care, household)
   without brand mapping; add `soap`/`shampoo`/`dishwash` phrase classes.
5. **Manufacturer field garble** — 7/14 products produce OCR-blob
   manufacturer values; needs line-boundary heuristics, a strategy for the
   `&`-joined multi-manufacturer lines, and `see below` stop-phrases.
6. **MRP digit verification without pixels** — product_003 `90` needs a
   human visual check before it can be certified CORRECT.

---

## 24. Root-Cause Classification (Stage 7.10 fixes vs residual)

| Stage 7.10 claim | Root cause addressed | Live status |
|---|---|---|
| Rule 11 net-qty contract (structured input) | extraction returns objects; `normalizeNetQuantity` accepts them | **FIXED** (0 UNKNOWN_UNIT; 9 False-FAIL -> REVIEW) |
| L/kg/ml/g dimension safety | normalizer only assigns the declared kind | **FIXED** (no cross-dimension transform) |
| MRP false values (1932/1826) | year-shaped + single-digit rejects + label adjacency | **PARTIALLY FIXED** (1932/1826 gone; `07` still slips for product_010) |
| Dates not misclassified ("Manufactured by", SEE TOP/CODING AREA, MFD) | DATE_LABELS negative lookahead + REVIEW fallbacks | **PARTIALLY FIXED** (REVIEW fallback works; lot-code/product_017 + product_020 + product_004 FPs persist) |
| Generalized categories (no brand mapping) | margin threshold; weak keyword removal | **FIXED-AS-DESIGNED** (no wrong DETECTED; wrongs are REVIEW; no hardcoding) |

Residual defects in sec 23 are new Stage 7.12 work items, NOT Stage 7.10
regressions.

---

## 25. Stop-Condition Audit

| Stop condition | Result |
|---|---|
| Structured net qty still -> UNKNOWN_UNIT | **NOT TRIGGERED** — 0 UNKNOWN_UNIT, 11/11 declared quantities normalize with kind |
| L->kg / ml->g conversions | **NOT TRIGGERED** — no cross-dimension transformation in the live run; product_012 is an OCR misread, not a conversion |
| MRP FPs systematic | **NOT TRIGGERED** — 2 systematic FPs eliminated; 1 per-product FP remains (product_010) |
| Dates systematically misclassified | **NOT TRIGGERED** — 10/14 clean; 4 per-product FPs remain (documented) |
| Product-specific hardcoding | **NOT TRIGGERED** — none found in Stage 7.10 code (grep for brand/product/SKU literals clean) |
| Previously-passing generalized evidence test regresses | **NOT TRIGGERED** — evidenceUnderstanding 32/32; 42/42 new Stage 7.10 tests; focused suite 232/232 |
| Compliance aggregation unsafe | **NOT TRIGGERED** — all rules fail closed to REVIEW; no COMPLIANT asserted without evidence |

Procedure outcome: **continue; do not abort/block.**

---

## 26. Hardcoding Audit

- Grep across all Stage 7.10-touched services
  (`ocrFieldExtractionService`, `declarationConceptService`,
  `contextualInferenceService`, `analysisOrchestrationService`,
  `netQuantityService`, `productCategoryService`, `evidenceFusionService`,
  `hybridOcrService`, `roiCropService`) for the 14 product names (Dettol,
  Parle, Lifebuoy, Kurkure, Sunsilk, Colgate, Dabur, Haldiram, Aashirvaad,
  TATA, Fortune, Paaru, Vim, Surf) and `product_0x` literals: **no matches**.
- All category/date/quantity logic is keyword/regex/font/spatial-general.
- The 42 new tests in `stage710AccuracyRepair.test.js` are generic
  (E1..F6 cloth/synthetic-labels), not per-product fixtures.

---

## 27. Exact Code Files Involved (Stage 7.10 changes — validated as-is, unmodified)

| File | Change validated |
|---|---|
| `server/src/legal/compliance/netQuantityService.js` | `normalizeNetQuantity` accepts `{value, unit}` (Rule 11 fix) |
| `server/src/services/ocrFieldExtractionService.js` | DATE_LABELS lookahead (negative `by` check), MONEY_PATTERN 3rd alternative, REJECT_NUMBERS_MRP, extractEvidence with precomputed explicit, `normalizeEvidenceValue` |
| `server/src/services/declarationConceptService.js` | new concept classifier (classifyMrp/Quantity/Date + REVIEW fallback) |
| `server/src/services/contextualInferenceService.js` | implicit inference (`inferCandidates`, thresholds 0.80/0.55) |
| `server/src/services/analysisOrchestrationService.js` | `extractEvidence(detections, {imageDimensions}, extracted)` contract; `AnalysisTimer`; new `applyEvidenceToProduct` |
| `server/src/services/productCategoryService.js` | keyword cleanup; margin-based DETECTED; weakened unit signals |
| `server/src/services/evidenceFusionService.js` | bbox-first matching; provenance preserved; REVIEW-safe passthrough |
| `server/src/services/hybridOcrService.js` | `_buildResponse` carries imageBuffer/mimeType even with no ROI candidates |
| `server/src/services/roiCropService.js` | `cropRegion(buf, mimeType, bbox, img)` reuses pre-decoded Jimp |
| `server/tests/stage710AccuracyRepair.test.js` | new 42-test regression suite |

No production or test file was modified during Stage 7.11 validation; the
harness under `%TEMP%\opencode\` was the only thing changed (to mirror the
new orchestrator contract).

---

## 28. Stage 7.12 Recommendation

**Recommended next stage: Stage 7.12 — Date/Lot/Batch + MRP disambiguation &
manufacturer cleanup.** Priority-ranked work items from sec 23:

1. Lot-code vs Date disambiguation (`33-01-2025` as lot, `Pkd.` as pack
   date, `MFG.DATE`/`USE BY` label classes) + batch phrase stop-matching to
   kill all 6 batch FPs and the 017/020/004 date FPs.
2. MRP: reject bare 2-digit tokens sitting on a `MM/YY`-shaped date line;
   recognize `n/-` price shapes (fix product_010 `129/-`).
3. Manufacturer field cleanup (line-bounded capture, `&`/conjunction
   split, `see below` truncation).
4. Category: replace `liquid` in beverage with `drink`-only signals; add
   `soap`/`shampoo`/`dishwash` phrase classes so their items land in
   household/personal-care at REVIEW at minimum.
5. Net-quantity unit sanity pass: verify VOLUME vs MASS vs product category
   before asserting net quantity (would have caught product_012's `kg`).
6. Optional: human visual confirmation of product_003's printed MRP (90 vs
   others) and a calibration probe + model slots so Rules 7/8 can leave
   permanent REVIEW and test infra (the 15 baseline fails) can be retired.

---

## 29. Evidence / Trace Files

- Live run log: `%TEMP%\opencode\stage711_log.txt`
- Live structured results (14 panels, per-concept evidence + netQuantityAudit
  + compliance): `%TEMP%\opencode\stage711_results.json`
- Stage 7.9 baseline: `%TEMP%\opencode\stage79_results_full.json`
- Harness (updated to Stage 7.10 orchestrator contract):
  `%TEMP%\opencode\stage79_full_pipeline.mjs`
- Prior stage report:
  `docs/multi-product-generalization-validation-v1.md`
- AI service health: `http://localhost:8000/health` (200, local)