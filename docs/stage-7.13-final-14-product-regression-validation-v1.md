# SIH26034 · Stage 7.13 — Final 14-Product Regression Validation (Stage 7.12 code)

**Validation report — v1** · **VALIDATION ONLY — no production code changed in this stage.**

---

## 1. Executive Summary

Stage 7.12's adversarial-accuracy hardening was re-validated live against the SAME 14 real back
panels (unchanged dataset, unchanged local AI service, unchanged harness, unchanged production
code). Result: **all Stage 7.12 improvements reproduce, zero regressions, and the two critical
targets hold** — Dettol MRP is now `₹129` (was `7`) and the SKU-as-MRP is rejected with the real
MRP `30` preferred.

Headline evidence:

- **14/14 REVIEW** overall, `0` COMPLIANT, `0` NON_COMPLIANT, `0` BLOCKED — identical compliance
  posture to Stage 7.11 (fail-closed preserved; no false COMPLIANT).
- **All six Stage 7.11 defect classes stay fixed** on the fresh OCR run (MRP `7→129`, SKU reject,
  3 false dates gone, 6 false lots gone, true lot `BM5858` recovered, 0 `UNKNOWN_UNIT`, no
  incompatible unit conversion).
- **Run-to-run stability:** the Stage 7.13 live run and the Stage 7.12 live run (same code, two
  independent OCR passes) are **byte-identical for all 14 products** on every extracted field,
  net-quantity normalization, and category.
- **Provenance intact:** every selected field carries the full evidence shape
  (`concept/value/sourceType/evidence/bbox/confidence/signals/status`); candidate-audit signals
  (`candidate_count`, `bare_number_capped_review`, `date_relationship_conflict_downgraded`) are
  preserved through `extractEvidence` and `fuseEvidence`.
- **Tests:** Stage 7.12 suite 42/42; focused suites 185/185; full repository 496/511 with the
  identical 15 pre-existing baseline failures (Jest-style + model-infra). No focused-test
  regression.
- **Performance:** 279.4 s total (vs 285.7 s in 7.11), 20.0 s mean, 99.9 % OCR share — no
  meaningful regression.
- **Hardcoding:** no brand/product/evidence-value/coordinates in production logic (only comments
  and generic category keyword lists).

No production or test file was modified during this validation. The only new artifacts are the
live-run JSON, its log, an analysis script, the full-test capture, and this report — all outside
the repository.

---

## 2. Stage 7.11 Baseline (Stage 7.10 code — recorded)

From `docs/stage-7.11-live-14-product-validation-v1.md` and `%TEMP%\opencode\stage711_results.json`:

| ID | Overall | MRP | NetQty | Batch | MFD | PKD | EXP | Category |
|---|---|---|---|---|---|---|---|---|
| 002 | REVIEW | 115 | – | – | – | – | – | household DETECTED .99 |
| 003 | REVIEW | 90 | 70 g | **INDICATES** | – | – | – | food DETECTED .99 |
| 004 | REVIEW | – | 20 g | – | – | – | **2000-05-01** | food DETECTED .99 |
| 007 | REVIEW | – | – | **Pkd** | – | – | – | food REVIEW .60 |
| 008 | REVIEW | – | 10 kg | **Pkd** | – | – | – | food DETECTED .99 |
| 009 | REVIEW | – | 42 g | **M.R.P.Incl** | – | – | – | unknown UNKNOWN 0 |
| 010 | REVIEW | **7** | – | – | – | – | – | household REVIEW .67 |
| 011 | REVIEW | – | 200 g | **MFG.DATE** | – | – | – | food DETECTED .99 |
| 012 | REVIEW | – | 15 kg* | – | – | – | – | food REVIEW .77 |
| 013 | REVIEW | – | – | – | – | – | – | food DETECTED .99 |
| 014 | REVIEW | 20 | 155 ml | – | – | – | – | beverage REVIEW .57 |
| 015 | REVIEW | – | 125 g | – | – | – | – | food REVIEW .63 |
| 017 | REVIEW | 399 | 1 kg | **and** | **2025-01-01** | **2026-07-28** | **2026-07-28** | food DETECTED .99 |
| 020 | REVIEW | – | – | – | **2022-10-01** | – | – | food REVIEW .60 |

`*` product_012 `15 kg` = OCR misread of the true 15 L tin (documented OCR-level, not a unit
conversion). 7.11 baseline totals: `285.7 s`, mean `20.4 s`, OCR share `99.9 %`.

Defects carried into Stage 7.12 (10 items): D1 Dettol MRP `7`; D2 SKU-as-MRP on 008; D3 020 MRP
`13-` fragment; D4 004 expiry money-as-date; D5 017 MFD via "Manufactured&Marketed by"; D6 020
MFD via toll-free; D7 017 dop==eod token duplication; D8 six batch FPs; D9 012 OCR unit misread
(documented, not fixable in code); D10 004 implicit 20 g (confirmed correct).

---

## 3. Stage 7.12 Baseline (Stage 7.12 code — recorded)

From `%TEMP%\opencode\stage712_results.json` (the stage 7.12 live re-run) and
`docs/stage-7.12-adversarial-accuracy-hardening-v1.md`. All 10 defects D1–D7/D8-D10 resolved
(or documented as OCR-level); all 14 overall REVIEW. The Stage 7.12 field results are listed in
Section 5 as the "same" column of the stability check — the Stage 7.13 run equals it exactly.

---

## 4. Stage 7.13 Live Methodology

1. **No code touched first.** `git status` inspected; the working tree is the unchanged Stage 7.12
   state (accumulated stage changes + reports; no new edits this stage).
2. **Infrastructure verified:** local AI `GET /health` → 200 (`sih-compliance-ai-service`), backend
   `http://localhost:5000/api/health` → `database: connected`. Harness forces
   `AI_SERVICE_URL=http://127.0.0.1:8000` (same as 7.11/7.12).
3. **Same harness:** `%TEMP%\opencode\stage79_full_pipeline.mjs` (unchanged; replicates
   orchestrator: hybrid OCR full+ROI → `extractProductFields` → `extractEvidence` →
   `applyEvidenceToProduct` (replica) → visual fusion → measurement → category → rule6 / rule789 /
   rule11 → overall aggregation; captures timings + `netQuantityAudit`).
4. **Same dataset:** the identical 14 directories `dataset/raw/proprietary/product_{002,003,004,
   007,008,009,010,011,012,013,014,015,017,020}` back views. Not replaced, removed, or modified.
5. **Fresh live run:** one full pass, output `%TEMP%\opencode\stage713_results.json`, log
   `%TEMP%\opencode\stage713_log.txt`.
6. **Comparison analysis:** `%TEMP%\opencode\stage713_analyze.mjs` produced the 7.11→7.13 field
   diff, target-case checks, provenance-shape audit, net-quantity audit, and performance stats.
7. **Tests:** Stage 7.12 suite, focused suites, full `node --test` sweep;
   full-suite TAP captured to `%TEMP%\opencode\stage713_fulltests.txt`.
8. **Labels:** field comparisons use IMPROVED / UNCHANGED-CORRECT / REMOVED-FALSE-POSITIVE /
   RECOVERED-VALUE / REGRESSION. Ground truth from the pipeline's own OCR corpus (no image
   viewing; nothing fabricated).

---

## 5. 14-Product Results Table (Stage 7.13 live)

All 14: **overall=REVIEW**, rule6=REVIEW, rule789=REVIEW, rule11=REVIEW. MRP detail = value ·
sourceType · status · confidence · signals (asserted = written to product fields; REVIEW =
evidence-only, not written).

| ID | MRP (asserted) | MRP detail | NetQuantity | Kind | Batch | MFD | PKD | EXP | Category |
|---|---|---|---|---|---|---|---|---|---|
| 002 | 115 | SPATIAL PASS .76 explicit_label | – | – | – | –(REVIEW, SEE CODING AREA) | – | – | household DETECTED .99 |
| 003 | 90 | SPATIAL PASS .77 explicit_label | 70 g | MASS | – | – | – | – | food DETECTED .99 |
| 004 | (REVIEW 5) | IMPLICIT REVIEW .60 Rs.5.00 not asserted | 20 g | MASS | – | – | – | – | food DETECTED .99 |
| 007 | – | – | – | – | – | – | – | – | food REVIEW .60 |
| 008 | 30 | SPATIAL PASS .84 explicit_label (SKU rejected) | 10 kg | MASS | – | – | – | – | food DETECTED .99 |
| 009 | – | – | 42 g | MASS | – | – | – | – | unknown UNKNOWN 0 |
| 010 | 129 | IMPLICIT PASS 1.0 slash_notation | (210 ml REVIEW) | VOLUME | – | – | – | – | household REVIEW .67 |
| 011 | – | – | 200 g | MASS | – | – | – | – | food DETECTED .99 |
| 012 | – | – | 15 kg* | MASS | – | – | – | – | food REVIEW .77 |
| 013 | – | – | – | – | – | – | – | – | food DETECTED .99 |
| 014 | 20 | EXPLICIT PASS .90 MRP20/- | 155 ml | VOLUME | –(REVIEW, SEE TOP) | –(REVIEW, SEE TOP) | – | – | beverage REVIEW .57 |
| 015 | – | – | 125 g | MASS | – | (REVIEW 2017-07-01, not asserted) | – | – | food REVIEW .63 |
| 017 | 399 | SPATIAL PASS .77 MRPR...399.00 | 1 kg | MASS | **BM5858** (SPATIAL .94 explicit) | – | REVIEW 28-07-2026 (conflict) | REVIEW 28-07-2026 (conflict) | food DETECTED .99 |
| 020 | – | – | (360 ml REVIEW) | VOLUME | – | – | – | – | food REVIEW .60 |

`*` OCR misread, unchanged (documented). Parenthesised REVIEW entries are evidence-only and are
NOT written to product fields (fail-closed). `–` = null/absent.

**Stability check (Phase 4/6 requirement):** the Stage 7.13 run was diffed field-by-field
against the Stage 7.12 run for all 14 products (mrp, batch, all three dates, net-quantity
normalization, category) — **every product `SAME`**. The improvements reproduce across
independent OCR passes.

---

## 6. 7.11 vs 7.13 Comparison

| Product | Field | 7.11 | 7.13 | Classification |
|---|---|---|---|---|
| 003 | batch | INDICATES | – | FALSE POSITIVE REMOVED |
| 004 | expiry | 2000-05-01 | – | FALSE POSITIVE REMOVED |
| 007 | batch | Pkd | – | FALSE POSITIVE REMOVED |
| 008 | mrp | – | 30 | VALUE RECOVERED (real label MRP; SKU rejected) |
| 008 | batch | Pkd | – | FALSE POSITIVE REMOVED |
| 009 | batch | M.R.P.Incl | – | FALSE POSITIVE REMOVED |
| 010 | mrp | 7 | 129 | FALSE MRP REMOVED + TRUE MRP RECOVERED |
| 011 | batch | MFG.DATE | – | FALSE POSITIVE REMOVED |
| 017 | batch | and | BM5858 | FALSE POSITIVE REMOVED + TRUE LOT RECOVERED |
| 017 | mfd | 2025-01-01 | – | FALSE POSITIVE REMOVED |
| 017 | pkd | 2026-07-28 | –(REVIEW conflict) | DUPLICATION DE-ESCALATED to REVIEW |
| 017 | expiry | 2026-07-28 | –(REVIEW conflict) | DUPLICATION DE-ESCALATED to REVIEW |
| 020 | mfd | 2022-10-01 | – | FALSE POSITIVE REMOVED |
| 020 | mrp (REVIEW) | 13 | – | FALSE POSITIVE REMOVED |

Unchanged-correct: 002 mrp 115; 003 mrp 90, 70 g; 004 20 g; 008 10 kg; 009 42 g; 011 200 g; 012
15 kg (OCR misread, documented); 014 mrp 20, 155 ml; 015 125 g; 017 mrp 399, 1 kg. All 14
overall/rule statuses unchanged (REVIEW). **No fields degraded. No new errors. No new false
positives.**

### 6.1 Stage 7.12 target cases (explicit verification)

1. **Dettol MRP (product_010):** `7` → **129** (IMPLICIT_PASS, confidence **1.0**,
   signals `implicit_slash_notation,nearby_price_word,declaration_region,prominent_typography,
   candidate_count:1`; evidence `129/-.0.61/ml 8901396602491 07/25.#07/27 BSTT342` — the barcode,
   unit-fraction and date fragments in the same node no longer outvote the isolated amount).
2. **SKU-as-MRP (product_008):** 9-digit `013000101` rejected (`REJECT_NUMBERS_MRP`); real label
   MRP **30** preferred (SPATIAL .84, evidence `MRPRs ... 30Gofast ...`). No fabricated 8/9-digit
   MRP.
3. **False dates remain cleared:** 004 expiry gone; 017 mfd/pkd/exp gone; 020 mfd gone — all three
   products null on the fresh OCR run.
4. **False lots remain cleared:** 003/007/008/009/011 → null.
5. **True batch remains recoverable:** 017 `Lot No. BM5858` (SPATIAL PASS .94, evidence present).
6. **OCR unit noise:** 0 `UNKNOWN_UNIT`; MASS/VOLUME kinds kept per declared unit; 012 kg/MASS
   unchanged (OCR misread, no code-level L→kg conversion exists).

---

## 7. MRP Regression Analysis

- **Explicit MRP still detectable:** 002 `115` (.76), 003 `90` (.77), 014 `20` (.90),
  017 `399` (.77) — all PASS, all unchanged from 7.11. Legitimate MRP is **not** over-rejected.
- **Competing numbers handled safely:** 010's node contains `129/-`, `0.61/ml`, a 13-digit barcode
  8901396602491, `07/25`, `07/27`, `BSTT342` — the isolated-amount shape check + slash notation
  select `129` deterministically (candidate_count:1).
- **Non-MRP shapes never become MRP:** toll-free `1800-10-22-221` lands only in consumerCare
  (020); `07/25`/`07/27` are dates, not MRP; `0.61/ml` is rejected; SKU `013000101` rejected (008);
  `399.00` parsed with `.00` intact (017); `Rs.5.00` is a true MRP but held at REVIEW (.60) —
  conservative, not asserted (004).
- **Ambiguous/low-confidence candidates → REVIEW:** 004 (Rs.5.00, REVIEW .60). No PASS from
  a bare ambiguous number (bare numbers capped to REVIEW by `bare_number_capped_review`).
- **No MRP regression:** every 7.11-correct MRP is identical; the two 7.11 FPs (`7`, `13-`) are
  absent.

---

## 8. Date Regression Analysis

- **MFD vs EXP vs PKD distinguishable:** 017 separates MFD (no mfd emitted — "Manufactured&Marketed
  by" anchors only MANUFACTURER and is never a date) from PKD (`Pkd. Lot No. 28-07-2026`) and Use
  By (`Use By Uso By 28-07-2026`). Both remaining candidates correctly de-escalate to REVIEW via
  `date_relationship_conflict_downgraded` (the true pack date 28-07-2026 is present but cannot be
  asserted against a conflicting use-by token — fail-closed).
- **SEE CODING AREA / SEE TOP do not become MFD or batch:** 002 `#MFD.SEE CODING AREA.` → mfd
  REVIEW null; 014 `#MFD.& Batch No.: See Top/Seal` → both mfd and batch REVIEW null.
- **"Manufactured by" does not become MFD:** 017 evidence `Manufactured&Marketed by: BM) DABUR...`
  → MANUFACTURER concept only; no date. MFD label regex blocks `mfd. by`/`manufactured by` forms.
- **Ambiguous standalone dates stay conservative:** 015 `C7/2017...` → mfd REVIEW `2017-07-01`
  (conf .75, signals `month_year_format,nearby_manufacturing_word`), **not asserted**.
- **Money-as-date and toll-free-as-date stay blocked:** 004 `Rs.5.00` no longer yields May-2000;
  020 `1800-10-22-221` is consumer-care only.
- **No date field that was correct in 7.11 changed; every 7.11 wrong date is gone or REVIEW.**

---

## 9. Batch Regression Analysis

- **Explicit "Batch No." / "Lot No." remain detectable:** 017 `Lot No. BM5858` → PASS .94
  (SPATIAL, evidence retained).
- **Split-label / spatial association functional:** all batch/lot values come from real
  label-adjacent OCR evidence with bbox; none are absent where a value genuinely exists except
  where the pack directs elsewhere (014 "See Top/Seal" → REVIEW null, correct).
- **Label/prose/phone/quantity tokens never become batch:** `INDICATES`, `Pkd` (x2),
  `M.R.P.Incl`, `MFG.DATE`, `and` — all null. `isPlausibleBatchCode` (len 2–20, alnum/dash set,
  ≥1 digit + letters or long numeric run) keeps `BM5858` while dropping prose and other labels.
- **Date-shaped lot `33-01-2025`** (7.11 source of 017's false MFD) is not re-introduced as a
  false date; no new batch FPs.

---

## 10. Net Quantity / Unit Safety

Declared → normalized (0 `UNKNOWN_UNIT`, 0 incompatible conversion):

| ID | Declared | Normalized | Kind | Base |
|---|---|---|---|---|
| 003 | 70 g | 70 g | MASS | 70 g |
| 004 | 20 g | 20 g | MASS | 20 g |
| 008 | 10 kg | 10 kg | MASS | 10000 g |
| 009 | 42 g | 42 g | MASS | 42 g |
| 010 | 210 ml (REVIEW) | 210 mL | VOLUME | 210 mL |
| 011 | 200 g | 200 g | MASS | 200 g |
| 012 | 15 kg | 15 kg | MASS | 15000 g |
| 014 | 155 ml | 155 mL | VOLUME | 155 mL |
| 015 | 125 g | 125 g | MASS | 125 g |
| 017 | 1 kg | 1 kg | MASS | 1000 g |
| 020 | 360 ml (REVIEW) | 360 mL | VOLUME | 360 mL |

- MASS stays MASS, VOLUME stays VOLUME; **kg and L are never cross-converted**. The normalizer
  only assigns the declared kind (verified in Stage 7.10/7.11; unchanged code).
- 010/020 REVIEW candidates (210 ml, 360 ml) are evidence-only and NOT written to product fields.
- Density/unit-price shapes (`0.61/ml`, `0.50g/ml`) are rejected upstream; none appear in declared.
- No malformed units in this corpus; `UNKNOWN_UNIT` count **0** (same as 7.10/7.11/7.12).

---

## 11. Category Regression

| ID | 7.13 category | Change vs 7.11 |
|---|---|---|
| 002 | household DETECTED .99 | same, correct |
| 003 | food DETECTED .99 | same, correct |
| 004 | food DETECTED .99 | same, correct |
| 007 | food REVIEW .60 | same, correct label |
| 008 | food DETECTED .99 | same, correct |
| 009 | unknown UNKNOWN 0 | same, honest abstain |
| 010 | household REVIEW .67 | same, correct |
| 011 | food DETECTED .99 | same, correct |
| 012 | food REVIEW .77 | same, correct |
| 013 | food DETECTED .99 | same, correct |
| 014 | beverage REVIEW .57 | same, wrong label but REVIEW (dishwash) |
| 015 | food REVIEW .63 | same, wrong label but REVIEW (soap) |
| 017 | food DETECTED .99 | same, correct |
| 020 | food REVIEW .60 | same, wrong label but REVIEW (shampoo) |

- **No unsafe DETECTED misclassification:** every DETECTED (.99) is a correct label; all wrong
  labels are REVIEW at <0.8 confidence. Zero change from 7.11/7.12.
- **Category never forces unit conversion:** 012 stays `MASS kg` (no L-forcing), 014 stays
  `VOLUME ml` — category does not alter `normalizeNetQuantity` input or output (no such code path).
- **Category does not override stronger explicit evidence:** field extraction is category-blind;
  declared quantities/MRP come from label evidence, not domain.

---

## 12. Rule 6 Regression

- 14 × **REVIEW** (identical to 7.11/7.12). Valid evidence *can* satisfy the expression clauses,
  but the net-quantity display rule remains REVIEW because no calibrated measurement is attached —
  the intended fail-closed state.
- Weak/ambiguous evidence never passes (REVIEW stays REVIEW across all products); missing
  evidence remains REVIEW. No rule-6 semantics changed (Stage 7.12 touched zero compliance code).

---

## 13. Rule 7 Regression

- 14 × **REVIEW**. Clause reasons reconfirm the trust boundary is unchanged:
  - `numeralLetterHeight` / `letterHeight` / `letterWidthRatio` / `quantityTypeDependentSize` →
    "requires physical measurement/calibration. Image is uncalibrated."
  - `smallPackage` → missing `packageDimensions` context, cannot determine applicability.
  - `medicalDeviceOverride` → domain not `medical_device`, or no such evidence.
- All `measurementEvidence` show `measurementStatus: UNCALIBRATED`, `calibrationTrust: UNKNOWN`,
  `physicalWidth/Height: null`, `uncertainty: 0`. **No caller-supplied threshold becomes trusted**
  (only physical widths would). Missing calibration → REVIEW, exactly as before.

---

## 14. Rule 8 Regression

- 14 × **REVIEW**. Rule 8 clause reasons reconfirm:
  - `pdpLocation` → "PDP detection requires visual model. Current status:
    UNAVAILABLE_MODEL_MISSING. Safe fallback to REVIEW."
  - `declarationPlacement` → manual review required (visual model cannot detect obstruction).
  - `surroundingSpace` / `wrapperVisibility` / `presentedDeclarations` → insufficient/visual-only.
- `fusedEvidence` shows `visualInferenceStatus: UNAVAILABLE_MODEL_MISSING`, `pdpDetected: false`
  on all 14. **No automatic FAIL from missing model** (all REVIEW). Visual-success rules and the
  safe-fallback path unchanged.

---

## 15. Rule 9 Regression

- 14 × **REVIEW** (Rule 9 is evaluated under `rule789`). All clause reasons REVIEW:
  `legibility/prominence/contrastingPresentation` require visual assessment ("OCR text detection
  and high OCR confidence do NOT prove legal legibility"); `languageFramework` missing commodity
  context; three clause keys have no evaluator registered → REVIEW. Conservative behavior
  unchanged.

---

## 16. Rule 11 Regression

- 14 × **REVIEW** (expression clauses PASS; MPE clause REVIEW pending calibrated measurement).
  Structured `{value, unit}` normalization still works (Section 10); **0 `UNKNOWN_UNIT`**;
  **no incompatible unit conversion**; **no systematic false FAIL** (9 products that were FAIL in
  Stage 7.9 remain REVIEW — the Stage 7.10 fix holds through 7.12/7.13 unchanged).

---

## 17. Overall Aggregation Regression

- All 14: `getOverallComplianceStatus([REVIEW, REVIEW, REVIEW])` → **REVIEW**. Identical to 7.11.
- No `FAIL` → no `NON_COMPLIANT`; no `COMPLIANT` from incomplete evidence (COMPLIANT can only arise
  from PASSed rules with evidence); REVIEW is never dropped from aggregation; empty/null statuses
  remain REVIEW. Aggregation semantics unchanged (compliance code untouched this stage).

---

## 18. Provenance Regression

- **Shape audit:** for every selected evidence entry across all 14 products (`mrp`,
  `netQuantity`, `batchLotNumber`, `dateOfManufacture`, `dateOfPacking`, `expiryOrUseByDate`) the
  full 8-field shape was verified present:
  `{concept, value, sourceType, evidence, bbox, confidence, signals, status}`. **No field lost
  provenance** (0 deficits).
- **Candidate audit:** winning candidates carry reasons via `signals` + sourceType +
  `candidate_count` (010 129: `candidate_count:1`, 004 5: `candidate_count:1`, implicit REVIEW.
  Rejection reasoning is addressable: bare-cap signal, `REJECT_NUMBERS_MRP`, `/-` strictness).
- **Ambiguity represented:** 017 pkd/exp both carry `date_relationship_conflict_downgraded`
  (evidence points at the actual OCR lines `Pkd. Lot No. 28-07-2026` / `Use By Uso By 28-07-2026`);
  015 mfd REVIEW with `month_year_format`; SEE TOP / SEE CODING AREA REVIEWs with rawValue.
- **Fusion preserves provenance:** `fuseEvidence` keeps the same shape and appends
  `spatialRelationToPdp` + `fusionReason` (e.g. "REVIEW declaration preserved through fusion");
  nothing is flattened or dropped (7.12's competition changes did not damage this path — proven by
  the identical 7.12↔7.13 stability diff).
- **Provenance points to real OCR text:** every `evidence` string above is verbatim OCR content
  (e.g. `129/-.0.61/ml 8901396602491 07/25.#07/27 BSTT342`). No synthetic values.

---

## 19. Performance Comparison

| Metric | 7.11 | 7.12 | 7.13 (fresh) |
|---|---|---|---|
| Total (14 panels) | 285.7 s | 283.6 s | **279.4 s** |
| Mean | 20.4 s | 20.3 s | **20.0 s** |
| Median | – | – | **15.3 s** |
| Min | – | – | **8.4 s** |
| Max | 51.8 s (Parle-G) | – | **49.4 s** (Parle-G 003) |
| OCR share | 99.9 % | 99.9 % | **99.9 %** (279.1 s of 279.4 s) |

- Extraction phase: 118 ms total (3–26 ms/panel). Visual/measurement/category/rules all
  ms-scale. Extraction CPU cost is negligible.
- 7.13 vs 7.11: −2.2 % total, −2 % mean — machine/queue noise, **no meaningful performance
  regression**; OCR still dominates and no new OCR passes were added.

---

## 20. Test Results

| Suite | Ran | Pass | Fail |
|---|---|---|---|
| Stage 7.12 (`stage712AdversarialAccuracy.test.js`) | 42 | 42 | 0 |
| Focused (11 re-testable suites, incl. stage710 ×42, evidenceUnderstanding ×32, evidenceFusion, measurement, ocr/spatial extraction, category, overall, orchestration) | 185 | **185** | 0 |
| Full `node --test server/tests/**/*.test.js` | 511 | 496 | 15 |

- Full-suite count **identical to the Stage 7.12 baseline (496/511)**.
- **No previously passing focused test regressed** (185/185).

---

## 21. Known Baseline Failures (unchanged)

The 15 full-suite failures are the pre-existing, environment/legacy set recorded since Stage 7.9 —
none touch extraction, evidence, rules, or the three files changed in Stage 7.12 (verified by
import grep):

- **Jest-style `describe is not defined` under `node:test` (9 files):**
  `datasetScaling`, `hybridOcrService`, `ocrPreprocessing`, `productHistory`,
  `proprietaryBaseline`, `proprietaryDatasetIngestion`, `roiCropService`, `weakSupervision`,
  `yoloFoundation`.
- **Model-promotion infra API drift (6 tests):** Continuous Learning Pipeline (Tests 7–8:
  `modelRegistry.evaluateAndPromote is not a function`), Production Continuous-Learning Training
  Infrastructure (Tests K/M/O/P).

Additionally, in the full-suite run the `trainingWorker` suite failed once per invocation with
`EPERM: operation not permitted, rmdir ...\fixtures\dataset\annotations` — a **Windows file-lock
condition on shared test fixtures** under `node:test` concurrency. It **passes standalone (2/2)**
and is environmental, not evidence/rule/extraction logic (no production code involved).

---

## 22. Hardcoding Verification

- Source grep across `server/src` for the 14 product names (Dettol, Parle, Kurkure, TATA,
  Aashirvaad, Colgate, Dabur, Haldiram, Fortune, Paaru, Vim, Surf, Sunsilk, Lifebuoy),
  `product_0x` literals, and the exact defect values (`13000101`, `BM5858`, `1800-10-22`,
  `2026-07-28`, `Rs.5.00`): **all hits are code comments** in
  `contextualInferenceService.js` (131), `ocrFieldExtractionService.js` (23,229,334,573,667,678)
  and one generic `product_001` doc example in `imageMetadataService.js` (95). No executable
  value-based logic.
- No brand-specific conditions, product-specific branches, exact 14-product values, exact image
  conditions, one-off coordinates, or test-data-driven production logic. Remaining keyword lists in
  `productCategoryService.js` are generic category dictionaries (detergent/dishwash/soap phrase
  classes), not product rules.
- **No production code changed during this validation** (`git status` matches the Stage 7.12
  state; only `%TEMP%` artifacts and this report were created).

---

## 23. Remaining Limitations

1. **Visual model unavailable** → Rules 7/8/9 stay REVIEW by design; no automatic FAIL, but the
   pipeline cannot certify legibility/PDP until the model slot is restored.
2. **product_012** net quantity `15 kg` is an OCR misread of the true 15 L tin — OCR-level, not a
   code conversion; a calibrated-image measurement path is the warranted remedy.
3. **product_004** real MRP `Rs.5.00` is correctly detected but held at REVIEW (confidence .60)
   and not asserted — conservative but under-reported until evidence boosts it.
4. **Wrong-label categories at REVIEW** (014 dishwash→beverage, 015 soap→food, 020 shampoo→food)
   are safe (REVIEW, not DETECTED) but remain wrong labels.
5. **MRPs on front panels** (008 historically, 009, 013) stay missed on back-panel OCR where the
   pack does not print them on the back.
6. **Manufacturer field** remains OCR-blob garbled for several products (002, 017, 020) — cosmetic
   field quality, not compliance affect.
7. **Test infra debt:** 15 legacy/environmental failures + the `trainingWorker` fixture file-lock
   flake remain; harmless to evidence/rule coverage.

---

## 24. Final Verdict

**PASS — with the standing limitations inherited from prior stages.**

Decision framework evaluation:

| Check | Result |
|---|---|
| All critical regression checks pass | **YES** |
| Stage 7.12 improvements remain intact | **YES** — reproduced identically on a fresh OCR run |
| No new meaningful false positives | **YES** — 0 new; 10/10 defect classes stay fixed |
| No unit-safety violation | **YES** — 0 UNKNOWN_UNIT, MASS≠VOLUME, no L↔kg conversion |
| No provenance loss | **YES** — full 8-field shape + candidate/audit signals everywhere |
| No compliance aggregation regression | **YES** — 14/14 REVIEW, identical to 7.11 |
| Tests green except known baseline failures | **YES** — 42/42, 185/185 focused, 496/511 full (identical baseline) |
| No product-specific hardcoding | **YES** — comments only; no production changes made |

No critical safety regression, no incompatible unit conversion, no lost provenance, no return of
the 7.11 MRP/date/batch defects, no false COMPLIANT, no focused-test regression, no product
hardcoding, no unexplained performance regression. Correspondingly, **no repair stage is justified
and none is proposed**; the improvements from Stage 7.12 are confirmed stable and non-regressive.

**FINAL RULE respected:** NO COMMIT, NO PUSH, NO PRODUCTION CODE CHANGES. This is validation-only.

---

### Evidence / Trace Files

| Artifact | Path |
|---|---|
| Stage 7.13 live results | `%TEMP%\opencode\stage713_results.json` |
| Stage 7.13 live log | `%TEMP%\opencode\stage713_log.txt` |
| Stage 7.13 analysis script | `%TEMP%\opencode\stage713_analyze.mjs` |
| Full-suite TAP capture | `%TEMP%\opencode\stage713_fulltests.txt` |
| Stage 7.12/7.11/7.9 results | `%TEMP%\opencode\stage712_results.json`, `stage711_results.json`, `stage79_results_full.json` |
| Harness (unchanged) | `%TEMP%\opencode\stage79_full_pipeline.mjs` |
| This report | `docs/stage-7.13-final-14-product-regression-validation-v1.md` |
| Prior reports | `docs/stage-7.12-adversarial-accuracy-hardening-v1.md`, `docs/stage-7.11-live-14-product-validation-v1.md` |