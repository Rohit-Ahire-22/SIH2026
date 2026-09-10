# STAGE 7.9 — MULTI-PRODUCT GENERALIZATION VALIDATION: FINAL VERDICT REPORT

- **Stage**: SIH26034, Stage 7.9 (Multi-Product Generalization Validation)
- **Date**: 2026-09-10
- **Method**: External validation harness executed against the production pipeline code (imported the genuine production services: HybridOcrService, RoiCropService, weakRoiCandidateService, ocrClientService, ocrFieldExtractionService, contextualInferenceService, evidenceFusionService, measurementEvidenceService, productCategoryService, rule6/rule-7/8/9/rule11 compliance services, analysisOrchestrationService aggregation), reading real product images from `dataset/raw/proprietary/*/back*.jpg` and calling the **local** AI service (`http://127.0.0.1:8000`, `X-AI-Service-Key` present). Render endpoint confirmed unreachable (timeout). No production files, routes, thresholds, schema, or legal vocabulary were changed. Reports: `docs/multi-product-generalization-validation-v1.md`.

---

## 1. Verification Method & Verdict

**Verdict: PASS WITH LIMITATIONS.**

The end-to-end pipeline (hybrid OCR → extraction → contextual inference → evidence fusion → measurement → category → Rule 6/7/8/9/11 → aggregation) executes **unchanged** across 14 genuinely different packaged commodities and never fails open. Fail-closed behaviour is preserved in every case: when a declaration cannot be seen, the system emits REVIEW, never COMPLIANT. Inference vocabulary (EXPLICIT_LABEL / IMPLICIT_CONTEXT / SPATIAL_ASSOCIATION / VISUAL / MEASUREMENT / FUSED) is correctly applied, and the measurement/visual layers degrade conservatively (`UNCALIBRATED` / `UNAVAILABLE_MODEL_MISSING`).

The limitations are material and are NOT legal-hardcoding issues:

1. A **systemic integration defect** in the Rule 11 path: `netQuantity` is persisted as a `{value, unit}` object (as in `Product.js`), but `rule11ComplianceService.evaluateNetQuantityExpression` passes it to `normalizeNetQuantity()`, which only accepts a string. Every one of the 9/14 products with a *successfully extracted* net quantity therefore receives `UNKNOWN_UNIT` → **Rule 11 FAIL** → overall NON_COMPLIANT. The net-quantity result is therefore guaranteed wrong whenever extraction succeeds (0% of extracted quantities produce a PASS). Presence-level understanding of net quantity is good (9/14 correct captures); the compliance outcome is inverted by the contract mismatch.
2. **Value-level false positives** in MRP and dates: 3 wrong MRP values were promoted to Rule 6 MRP PASS (Parle-G `1932`, Dettol `7`, Lifebuoy `1826`), and 4 wrong date values were promoted to PASS (Kurkure expiry `2000-05-01`, Dabur manufacture date from a lot code, Sunsilk manufacture date despite "SEE TOP"). No plausibility/typicality guard exists at the rule layer, so structural-validity PASS does not imply value correctness.
3. **Category misfires** when OCR garbles the product name/brand: Vim Dishwash Gel → `beverage`, Lifebuoy Soap → `food`, Sunsilk Shampoo → `food`, Colgate toothpaste → `unknown`.

None of the above are product-specific special cases; they are generic weaknesses reproduced across brands, which is precisely what generalization validation must surface.

---

## 2. Products Tested

14 products, back (declaration) panel analysed per product, mirroring the orchestrator's behaviour of analysing the final image in `product.images`. All images are real (1200×1600 or other natural sizes), OCR+ROI executed live against the local AI service.

| ID | Product (from OCR) | Real category | Stored net qty | R6 | R789 | R11 | Overall |
|---|---|---|---|---|---|---|---|
| product_002 | Surf Excel Easy Wash | household detergent | null | REVIEW | REVIEW | REVIEW | **REVIEW** |
| product_003 | Parle-G Gluco Biscuits (70g+10g extra) | food | 70 g | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_004 | Kurkure Masala Munch (Rs.5 / 20 g) | food | 20 g | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_007 | TATA Salt | food (salt) | null | REVIEW | REVIEW | REVIEW | **REVIEW** |
| product_008 | Aashirvaad Atta (10 kg) | food (grain) | 10 kg | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_009 | Colgate MaxFresh (42 g) | personal care | 42 g | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_010 | Dettol Liquid Handwash (210 ml) | personal care | null | REVIEW | REVIEW | REVIEW | **REVIEW** |
| product_011 | Haldiram's Plain Bhujia (export, 200 g) | food | 200 g | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_012 | Fortune Soya Oil (15 L) | food (edible oil) | 15 kg* | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_013 | Paaru Fish Fry Masala (80 g) | food | null | REVIEW | REVIEW | REVIEW | **REVIEW** |
| product_014 | Vim Dishwash Gel (155 ml, MRP 20) | household | 155 ml | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_015 | Lifebuoy Soap (125 g) | personal care | 125 g | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_017 | Dabur Honey 1 kg (MRP ₹399) | food (honey) | 1 kg | REVIEW | REVIEW | FAIL | **NON_COMPLIANT** |
| product_020 | Sunsilk Black Shine Shampoo (360 ml) | cosmetic | null | REVIEW | REVIEW | REVIEW | **REVIEW** |

\* Fortune oil declared by volume — unit mis-captured as `kg` (see §5 / §18).

**9 NON_COMPLIANT, 5 REVIEW, 0 COMPLIANT, 0 PENDING.** Every NON_COMPLIANT is driven by Rule 11 FAIL, and the 9 Rule-11 FAILs correspond *exactly* to the 9 products where a net quantity was extracted. With net quantity null, Rule 11 correctly REVIEWs (missing). This perfect correlation is the empirical signature of the §1(1) contract bug, not 9 genuinely non-compliant labels.

---

## 3. Diversity

The 14 products span 8 distinct commodity families with distinct packaging conventions:

- **Foods**: biscuit (003), ready-to-eat snack (004), salt (007), flour (008), edible oil (012, volume), spice/masala sachet (013), honey (017).
- **Export/multi-language pack**: Haldiram's (011) — 106+ OCR boxes, German/French/Italian/Spanish, batch/MFG/BEST-BEFORE in code form.
- **Household**: detergent pouch (002), dishwash gel (014).
- **Personal care / toiletries**: toothpaste (009), handwash (010), soap (015), shampoo (020).
- **Layouts**: dense single-panel (009, 014), sparse corner capture (013, 020), long thin strip (009, 015), tall bottle back (010, 020), large bag declaration block (007, 008, 012), multi-brand multi-language (011).
- **Declaration vocabularies**: `MRP`, `M.R.P.`, `MAX.RETALPRICEE` (012), `A.R.P.` (013), `*MRP20/-` (014), `MRP Rs.` (017), `Rs.5.00 (INCL.OF ALLTAXES)` (004); `NET WT` (002), `NET WEIGHT` (003/008/015), `QTY` (004), `Net Content` (005), `Net Vol.` (014), `NET QUANTITY` (017), `NET CONTENTS AT 30'C` (012); `USE BY` (004), `BEST BEFORE` (003/008/012), `Expiry ... From MFD` (009), `MFD.&USE BEFORE: SEE CODING AREA` (015), `MFD. B.NO.& USE BEFORE: SEETOP` (020).
- **False-positive honey-traps**: brand-heritage years (003: 1932), lot codes (017: `33.01-2025`), batch-month stamps (010: `07/25.#07/27`), PETA badge (020: `PeTA`), PCB regs (011), addresses w/ PINs (002: B-7 MIDCO; 014: Puducherry-605102; 017: Baddi-173205), EAN-13 barcodes (010: 8901396602491), toll-free numbers (1800-10-22-221, 1800-225599), unit-sale prices (010: ₹0.61/ml; 008: ₹10.80/kg), promo text (`new pack`, `dhamaal ho jaaye!`).

---

## 4. Evidence Understanding by Concept

How well the pipeline understands each concept across the 14-panel corpus (value + sourceType + confidence produced):

- **MRP**: 6/14 any evidence; only 2 verified-correct values (014 ₹20, 017 ₹399); 4 missed (004, 007, 009, 012/013); 3 clear false positives (003 ₹1932, 010 ₹7, 015 ₹1826) + 1 low-confidence REVIEW-level FP (020 ₹13). Tax-inclusive flag almost always wrong: cast to `false` even when the panel prints "(incl. of all taxes)" because OCR glues words (`MRPINCL`, `MRPNCL.OF ALL TAXES`, `MRP<(INCLOFALLTAXES)`) and the `TAX_INCLUSIVE_PATTERN` requires spaces.
- **Net quantity**: 9/14 captured, 8 with correct value+unit (70 g, 20 g, 10 kg, 42 g, 200 g, 155 ml, 125 g, 1 kg); 1 unit error (15 L→`15 kg`); 5 missed (002, 007, 010, 013, 020). Structure/order ((`Net Wt. When Packed ... 125g`), (`QTY` complement `13.3g+6.7g Extra`) handled.
- **Manufacture/packing/expiry dates**: poor. False-positive manufacture dates from lot codes (`33.01-2025`), batch stamps (`07/25`), and “SEE TOP/SEE CODING AREA” ambiguity (2022-10-01 for Sunsilk whose label explicitly defers MFD to the top). Packing date correctly read once (017). Use-by/best-before captured once but conflated with the packing date value (017).
- **Batch/lot**: worst area — 6/14 got a *false* batch label ("INDICATES", "Pkd", "Pkd", "M.R.P.Incl", "MFG.DATE", "and"). No genuine batch code was ever captured (they are genuinely coded, e.g., "first two characters of the batch indicate...").
- **Manufacturer / packer / importer**: never clean; garbled long blobs absorb escape clauses, `Regd. Off.`, PINs and years (HUL entries), or pick PCB/registration numbers (011 `295/HOMPPCB/SE/Plastic/2018`).
- **Consumer care**: the strongest concept — 5/14 clean (`cs@parle.biz`, `consumeraffairs_india@colpal.com`+`1800-225599`, `CONSUMER.FEEDBACK@PEPSICO.COM`, `1800-10-22-221` ×2) and phone numbers are only used under an explicit consumer-care label. 9/14 missed contact.
- **Country of origin**: 2/14 — 008 correct-ish ("INDIA ..." + swallowed "No Preservatives"), 010 false ("AL Cleansers").
- **Product name / brand**: poor on back panels — 6/14 garbage ("THIS PACKAGING", ".DETERGENT", "dhamaal ho jaaye!", "CM195AWUK", "new pack/new", "PeTA", "G.L DATE", "powerful lather").
- **Category**: correct for the obvious foods (biscuit/snack/salt/atta/oil/masala/honey all food) and the detergent; wrong or uncertain for all non-food items (see §5).

---

## 5. Field-Level Accuracy vs OCR-Derived Ground Truth

Expected values below are the label content that the OCR text (the available ground-truth access for this harness) shows on each panel.

| Field | Correct | Missed (REVIEW-safe) | Wrong value promoted to PASS/FAIL | Notes |
|---|---|---|---|---|
| MRP value | 2 (014=20, 017=399) | ~5 (004, 007, 009, 012, 013) + 008 correctly kept REVIEW (₹10.8/kg is a unit price) | 3 (003=1932, 010=7, 015=1826); 002=115 plausible w/ unit-sale 0.14/g but unconfirmed | Structural PASS only; no plausibility check |
| MRP inclusion-of-tax flag | 0 | — | ~8 panels say “incl. of all taxes” yet flag=false | Space-free OCR breaks TAX_INCLUSIVE_PATTERN |
| Net quantity | 8 (value+unit) | 5 (002, 007, 010, 013, 020) | 1 unit error (012: 15 L→kg) | Also → Rule 11 FAIL via §1(1) bug |
| Mfg / packing / use-by dates | 1 (017 packing) | 6 panels carry date labels yet REVIEW | 4 (004 expiry 2000-05-01; 017 mfg 2025-01-01 from lot; 017 use-by=packing dup; 020 mfg 2022-10-01) | Mfg-date concept conflates lot/`MFD` stamps |
| Batch/lot | 0 genuine | — | 6 false batch labels | Generic label-word capture |
| Manufacturer name | 0 clean | 5 | 8 garbled (address+year+escape-clause blobs); 011 picked PCB no. | Greedy adjacency absorb |
| Consumer care | 5 | 9 | 0 (phones correctly gated by explicit label) | Best-behaving concept |
| Country of origin | 1 (008) | 12 | 1 (010 “AL Cleansers”) | Imported/export cases missed (011) |
| Product/brand name | ~2 | — | 6 garbage from back-panel text | Category feeds off this |
| Category | 8/14 exact | — | 4 (009 unknown, 014 beverage, 015 food, 020 food) | Keyword collisions + garbled name |

---

## 6. False-Positive Results

Tested explicitly for leaks to numeric/declaration fields:

- **Phone numbers**: never leaked into MRP/date/batch. 1800-10-22-221, 1800-225599 only appear as consumer-care. ✅ strong gate.
- **PIN codes** (400, B-7 MIDCO, 605102, 173205): absorbed into manufacturer address blobs, never parsed as dates/quantities. ⚠️ contamination but not misclassification.
- **Barcode / SKU digits**: `8901396602491` entered the MRP neighbour-text region of 010 and `2424306` entered Kurkure net-qty text; `CM195AWUK` became 011's product name. ⚠️ context contamination.
- **Brand-heritage / year tokens**: `1932` (Parle-G) became MRP ❌; `C7/2017` became a 2017 date REVIEW (Lifebuoy). ❌
- **Lot/batch code stamps**: `33.01-2025` became manufacture date ❌; `07/25.#07/27` became MRP=7 ❌; “Pkd”, “MFD.GATE”, “M.R.P.Incl”, “INDICATES” became batch numbers ❌.
- **Unit-sale-price rows** (₹0.61/ml, ₹10.80/kg): ₹10.8 correctly held at REVIEW; ₹129 region mis-picked as 7 ❌.
- **Promo/marketing text** (`new pack`, extra `10g`); `70g+10g*Extra=80g` — net qty kept 70 g (declared weight), acceptable.
- **Ingredient/dosage text**: `TFM 60%`, vegetable oils fed category misfires (015→food), none parsed as legal numbers. ⚠️

Net assessment: false-positive protection is strong for the consumer-care/phone path and for structural currency parsing, weak for date-vs-batch-vs-year discrimination and for MRP value plausibility (no typicality guard before r6 PASS).

---

## 7. Rule 6 Results (all 14 products)

Overall R6 = REVIEW on every product; clause-level detail (e.g., product_017, product_014, product_003):

- `manufacturerName` PASS (6/14), `manufacturerAddress` REVIEW (never evidences).
- `countryOfOrigin` NOT_APPLICABLE (importStatus DOMESTIC) everywhere.
- `commonGenericName` REVIEW everywhere.
- `netQuantity` PASS (9/14 — its own validator accepts the `{value, unit}` structure) — note the intra-rule inconsistency: **R6 accepts the object, R11 rejects it** (see §11).
- `dateOfManufacture`/`dateOfPacking` PASS only where a (sometimes false) date was captured; otherwise REVIEW.
- `bestBeforeUseBy` REVIEW — `commodityType` never supplied by the harness/legal context (fail-closed).
- `mrp` PASS where any structurally-valid money number was captured (incl. the 3 false values).
- `consumerCare` PASS where contact was under an explicit label — reason strings explicitly state "A random OCR phone number was not used as consumer-care evidence." ✅
- `dimensions` / `unitSalePrice` REVIEW — `dimensionsApplicable` / `unitSalePriceApplicable` flags unset (fail-closed).

---

## 8. Rule 7 Results (all 14 products)

Overall R7 = REVIEW for every product; every clause REVIEWs for the same two reasons:
- `numeralLetterHeight`, `letterHeight`, `letterWidthRatio`, `quantityTypeDependentSize`: physical measurement/calibration required; image `UNCALIBRATED`.
- `smallPackage`: `packageDimensions` context absent.
- `medicalDeviceOverride`: domain not `medical_device`.

This is correct behaviour: without calibrated imagery, Rule 7 can never PASS. No false PASS.

---

## 9. Rule 8 Results (all 14 products)

Overall R8 = REVIEW for every product. Every clause (`pdpLocation`, `declarationPlacement`, `surroundingSpace`, `presentedDeclarations` prominence/legibility, `wrapperVisibility`) is REVIEW. Reasoning is explicit and correct (see reasons in `stage79_results_full.json`, e.g., "PDP detection requires visual model. Current status: UNAVAILABLE_MODEL_MISSING. Safe fallback to REVIEW." and "OCR text detection and high OCR confidence do NOT prove legal legibility").

---

## 10. Rule 9 Results (all 14 products)

Overall R9 = REVIEW for every product: `legibility`, `prominence`, `contrastingPresentation` — REVIEW (visual assessment required, unavailable); `languageFramework` — REVIEW (`commodityType` absent); `readabilityThroughWrapper`, `prohibitionPreventNormalReading`, `priceQuantityPresentation` — REVIEW ("No evaluator registered for this Rule 9 clause key yet."). No clause ever PASSes without visual/panel evidence. Fail-closed correct.

---

## 11. Rule 11 Results

- **`netQuantityExpression`**: FAIL on 9/14, REVIEW on 5/14.
  - The 9 FAILs are **all** the products with an extracted net quantity, reason `"Net quantity declaration is invalid or malformed: UNKNOWN_UNIT"`.
  - Root cause (traced in code): `analysisOrchestrationService.applyEvidenceToProduct` writes `product.netQuantity = { value, unit }` (schema matches `Product.js`), and `evaluateRule11` → `normalizeNetQuantity(netQtyStr)` is public-facing as `if (typeof sourceText !== 'string') return _unknownResult(...)` → `validateQuantity` → `UNKNOWN_UNIT`. So a *successful* extraction is converted into a FAIL; only *missed* extractions yield REVIEW. **Classification: RULE_LOGIC / INTEGRATION contract mismatch (net quantity storage format vs rule11 string expectation).** It fails toward FAIL (never a silent PASS), so fail-closed posture is preserved, but the Rule 11 output is not meaningful until resolved.
- **`maximumPermissibleError`** (Schedule 1): REVIEW on all 14 — no calibrated physical measurement, and the reason correctly notes "An OCR declaration is evidence of what is printed on the package; it is not evidence of the actual physical quantity contained in the package." ✅

---

## 12. Overall Compliance Correctness

Aggregation (`getOverallComplianceStatus`: no statuses→REVIEW; any FAIL→NON_COMPLIANT; non-PASS/NOT_APPLICABLE→REVIEW) behaved exactly as specified. **Result correctness is dominated by the Rule 11 bug**: 9/14 `NON_COMPLIANT` are spurious (labels show genuine net-quantity declarations that the pipeline itself read correctly). The 5 `REVIEW` products are correct fail-closed outcomes for genuinely-undetected panels (002/007/010/013/020). There are no `COMPLIANT` results, so there is no over-emissive outcome; the risk is *unhelpful over-alarming* plus several false-positive field values sitting beneath `PASS` clauses (MRP 1932/7/1826, dates) that could be surfaced to a client as PASS.

---

## 13. Provenance Preservation

- Source types emitted correctly: `EXPLICIT_LABEL` (label-word anchors), `SPATIAL_ASSOCIATION` (anchor↔value pairing), `IMPLICIT_CONTEXT` (contextual inference at thresholds 0.55/0.80), and reviewer-side `VISUAL`/`MEASUREMENT` provenance in the fused/measurement blocks.
- ROI candidates carry `weak_candidate` provenance and `roiCandidateId`; fused OCR boxes are re-projected to original coordinates (bbox-first fusion contract verified; `EvidenceFusionService` tests pass, see §17).
- Visual status `UNAVAILABLE_MODEL_MISSING` preserved end-to-end and used to force Rule 8 REVIEW.
- Measurement status `UNCALIBRATED` / trust `UNKNOWN` (TRUSTED_CALIBRATION_SOURCES allowlist is still empty → no calibration path exists yet, correctly REVIEW).
- All evidence records keep `{concept, value, sourceType, evidenceText, bbox, confidence, signals, status}`.

---

## 14. Rule 8 Visual Status

`/visual/detect` returns `{"inferenceStatus":"UNAVAILABLE_MODEL_MISSING","detector":"yolo","model":"yolo11n-pdp","modelVersion":"none","detections":[]}` for every image (verified live). The YOLO artifact is absent; the system correctly downgrades every Rule 8 clause to REVIEW and never fabricates PDP detections. Blocking dependency for any Rule 8/9 affirmative finding (Stage 7.10: model artifact).

---

## 15. Rule 7 Calibration Status

`measurementStatus: UNCALIBRATED`, `calibrationTrust: UNKNOWN` for all 14 panels. No physical reference present in any photograph; TRUSTED_CALIBRATION_SOURCES empty. All height/MPE clauses conservatively REVIEW. No fabricated measurements ("observedQuantity NOT_AVAILABLE").

---

## 16. Performance (per-product, back panel, live AI-service latency)

| Metric | Value |
|---|---|
| Mean total analysis time | 19.7 s |
| Median | ~17.9 s |
| Min / Max | 8.4 s (013) / 49.1 s (003) |
| Hybrid OCR share of total | **99.9 %** (every product) |
| Extraction+evidence | < 40 ms aggregate |
| Visual fusion | < 25 ms (model-missing fast-path) |
| Measurement | < 2 ms |
| Category / Rule 6 / 789 / 11 | < 4 ms each |
| Summed (14 panels) | 276 s |

Longest panels: product_003 Parle-G 49.1 s (dense declaration block, 100 boxes), product_011 Haldiram's export 48.3 s (115 boxes), product_014 Vim 24.2 s, product_002 Surf 21.4 s. The dominant cost is remote PaddleOCR (full pass + ROI crop pass) — consistent with the Stage 7.8 latency verdict. All downstream analysis stages are negligible (<0.1%).

---

## 17. Test Results

`node --test server/tests/**/*.test.js` from repo root: **427 tests — 411 pass, 16 fail, 0 skipped.**

The 16 failures cluster into three pre-existing baseline categories (all unrelated to this stage's scope):
1. **Jest-style harnesses executed under node:test** (`describe is not defined`): `ocrPreprocessing`, `roiCropService`, `productHistory`, `datasetScaling`, `proprietaryBaseline` (also a mock-import export drift: `productController.js does not provide an export named getProdu…`), `proprietaryDatasetIngestion`, `yoloFoundation`, `weakSupervision`, `hybridOcrService`.
2. **MLOps registry/training slots not yet integrated**: `modelRegistry.evaluateAndPromote is not a function`, `registryService.evaluateAndPromote`, `Cannot read … 'registry'`, `Training Worker Integration Tests` (python `train_worker` command fails — YOLO/training env absent).
3. Nothing failed in evidence, extraction, inference, fusion, net-quantity, or Rule 11 logic.

Focused runs: `server/tests/evidenceUnderstanding.test.js` → **32/32 pass** (Stage 7.7 evidence suite green); EvidenceFusionService contract tests pass; `rule11ComplianceService` and `netQuantityService` tests pass. The 16 failures are governed by the missing model/registry environment and legacy test-driver style, not by the OCR→rules path exercised here.

---

## 18. Failure Root-Cause Classification (14 panels)

| Layer | Failures observed | Evidence | Root cause |
|---|---|---|---|
| OCR / PREPROCESSING | Garbled dense panels (002, 009, 014), glued words (`MRPINCL`, `MRPNCL.`, `M.R.P.Incl`) | §4, §6 | PaddleOCR degradation on dense line-joined declaration blocks |
| OCR (ROI) | 001 already known; ROI crop caused value/unit split (`15 kg`, `16.484-tre`) | 012 | ROI envelope contains partial rows; unit picked from cross-row neighbour |
| EXPLICIT_EXTRACTION | Manufacturer blobs absorb address/PIN/year/escape-clause (002, 008, 009, 011, 014, 015, 017); batch captures label words (`Pkd`, `MFG.DATE`, `INDICATES`) | §4 | Neighbourhood grow-and-merge too greedy; no stop on year/PIN/reg-no tokens |
| IMPLICIT/CONTEXTUAL_INFERENCE | MRP=7 from `07/25.#07/27`; mfg-date from `33.01-2025`; 020 mfg from `SEE TOP` region | 010/017/020 | Date-value picking prefers first numeric in context window; lot/batch stamp ≡ date stamp ambiguity |
| FALSE_POSITIVE_PROTECTION | MRP 1932/1826 promoted to PASS; year tokens (1932, 1826) not filtered; no money-plausibility pre-check before r6 MRP PASS | 003/015 | No typicality/amount plausibility gate; strict-but-fragile `TAX_INCLUSIVE_PATTERN` (space-sensitive) |
| CATEGORY | Vim→beverage (`liquid` keyword owned by beverage); Lifebuoy→food; Sunsilk→food; Colgate→unknown | 014/015/020/009 | Keyword design + reliance on productName/brandName from OCR |
| RULE_LOGIC / INTEGRATION | **9/14 Rule 11 FAIL from `UNKNOWN_UNIT` on object `netQuantity`** | all 9 FAIL | R6 net-qty validator accepts `{value,unit}`; R11 `normalizeNetQuantity` rejects non-string → contract mismatch |
| AGGREGATION | Outcomes inverted by the above (NON_COMPLIANT instead of REVIEW/PASS) | §12 | Cascades from RULE_LOGIC defect; aggregation itself correct |
| VISUAL_MODEL_UNAVAILABLE | Rule 8/9 all REVIEW | all | YOLO artifact missing (`UNAVAILABLE_MODEL_MISSING`) — by design |
| MEASUREMENT_CALIBRATION | Rule 7/MPE all REVIEW/UNCALIBRATED | all | No trusted calibration source; correct |
| TEST_HARNESS / ENVIRONMENT | 16 known failures (Jest-style + MLOps slots + python worker) | §17 | Pre-existing baseline; not introduced here |

Top recurring, cross-product patterns (highest ROI for Stage 7.10): (1) the Rule 11 netQuantity contract mismatch; (2) date-vs-lot/batch-year discrimination; (3) MRP value plausibility/inclusion-flag; (4) greedy manufacturer name merging; (5) category keyword collisions for non-food.

---

## 19. Hardcoding Audit

Searched the production path executed by the harness for any brand/product-specific literals: **none found.** The pipeline contains no product-name regexes, no brand allowlists, no size/unit presumptions, and no per-product rule overrides. Identical code ran all 14 products; all behaviour differences are emergent from OCR/evidence quality. `TRUSTED_CALIBRATION_SOURCES` is empty (no calibration hardcoding). No legal threshold or status vocabulary was modified.

## 20. Production-Code Changes (this stage)

- **Changed: none.** The harness and identity-scan scripts live outside the repo workload (`%TEMP%\opencode\stage79_*.mjs`); they only import production services.
- Confirmed `git status` delta matches only prior-stage work (evidence fusion/hybrid OCR/extraction services from 7.7/7.8; `contextualInferenceService.js`, `declarationConceptService.js`, `evidenceUnderstanding.test.js`, `scripts/profile_pipeline.mjs`). Nothing from Stage 7.9.
- No commits, no pushes (per stage constraints).

## 21. Stage 7.10 Targets (validated priorities)

1. **Rule 11 net-quantity contract fix** (P1): accept `{value, unit}` (or serialize to a canonical string) in `evaluateNetQuantityExpression` / `normalizeNetQuantity` so a captured quantity can actually PASS; add a regression test with 002/003/008/017-style panels.
2. **Date/lot/batch disambiguation** (P1): gate manufacture-date capture behind a label that is not also a lot/batch/`see coding area` stamp; add year-token filter (e.g., 4-digit year ≤ publication year+1, ≥ 1990) and reject `33.01-2025` style lot codes as mfg dates.
3. **MRP false-positive protection** (P1): pre-rule plausibility gate (amount band vs commodity, `lest` of inclusion flag robust to the space-free OCR variants: `INCLOFALL`, `NCL.OF ALL TAXES`, `INCL.OFALLTAXES`) before Rule 6 MRP PASS.
4. **Manufacturer-merging stop words** (P2): stop on `Regd.Off.`, `Lic.No.`, `CIN`, `Mktd.By`, PIN patterns, standalone years, `Store in a` … so names don't absorb address/legal-notes chunks.
5. **Category robustness** (P2): move generic `liquid`/`gel` out of beverage primary, add household dissonance guard; fall back to `REVIEW/UNKNOWN` instead of confident wrong category when name/brand missing.
6. **Rule 8/9 model artifact + Rule 7 calibration protocol** (P1/P2): supply `yolo11n-pdp` weights and a trusted calibration source to lift Rule 8/9 review and Rule 7 checks — blocked on staging infra, correctly preserved as REVIEW now.
7. **OCR latency** (P2): full+ROI two-pass PaddleOCR = 99.9% of each analysis; batch/cache ROI OCR, or local PaddleOCR inference, to cut per-image latency from ~20 s.

## 22. Final Recommendation

**PASS WITH LIMITATIONS — do not treat Rule 6/7/8/9/11 outputs as compliance verdicts yet.** The system already believes, with provenance, whether a declaration is present; fail-closed REVIEW behaviour is reliable across 14 diverse products, and consumer-care and country/date false-positive gates mostly hold. Before ANY external reading of an individual verdict, resolve the Rule 11 net-quantity contract mismatch (validates 9/14 results today), the date/lot disambiguation, and the MRP plausibility gate (the only channel through which a false value can reach PASS). Then re-run this same corpus as the Stage 7.10 regression harness — the results JSON mirrored end-to-end production code, so improvements are directly measurable against the baseline in this report.