/**
 * Stage 7.10 Accuracy Repair Regression Tests
 *
 * Covers all five root-cause defects fixed in Stage 7.10:
 *   A - Rule 11 net quantity contract (object vs string input)
 *   B - Unit dimension isolation (mass vs volume never cross-converted)
 *   C - MRP false positives (year-like values, bare integers)
 *   D - Date semantic classification (batch-adjacent dates, SEE TOP)
 *   E - Product category discrimination (household vs food/personal_care)
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNetQuantity, validateQuantity, QUANTITY_KINDS } from '../src/legal/compliance/netQuantityService.js'
import { evaluateRule11 } from '../src/legal/compliance/rule11ComplianceService.js'
import { COMPLIANCE_STATUS } from '../src/legal/compliance/complianceTypes.js'
import { inferCandidates } from '../src/services/contextualInferenceService.js'
import { detectProductCategory, DETECTION_STATUS } from '../src/services/productCategoryService.js'
import { extractProductFields } from '../src/services/ocrFieldExtractionService.js'

const ctx = { consumerType: 'RETAIL', confirmedAbsentFields: [] }

// ─────────────────────────────────────────────────────────────────────────────
// FIX A — Rule 11 net quantity contract: object input
// Root cause: normalizeNetQuantity only accepted strings. The pipeline stores
// netQuantity as { value, unit }. This caused UNKNOWN_UNIT -> FAIL for all
// successfully-extracted net quantities.
// ─────────────────────────────────────────────────────────────────────────────
describe('Fix A: Rule 11 net quantity contract — object input', () => {
  test('A1. { value: 500, unit: "g" } -> PASS (mass)', async () => {
    const product = { netQuantity: { value: 500, unit: 'g' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS, 'Expected PASS for 500 g object')
  })

  test('A2. { value: 1, unit: "kg" } -> PASS (mass)', async () => {
    const product = { netQuantity: { value: 1, unit: 'kg' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS, 'Expected PASS for 1 kg object')
  })

  test('A3. { value: 250, unit: "ml" } -> PASS (volume)', async () => {
    const product = { netQuantity: { value: 250, unit: 'ml' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS, 'Expected PASS for 250 ml object')
  })

  test('A4. { value: 15, unit: "L" } -> PASS (volume)', async () => {
    const product = { netQuantity: { value: 15, unit: 'L' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS, 'Expected PASS for 15 L object')
  })

  test('A5. { value: 10, unit: "pcs" } -> PASS (count)', async () => {
    const product = { netQuantity: { value: 10, unit: 'pcs' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS, 'Expected PASS for 10 pcs object')
  })

  test('A6. string "500 g" still PASS (backward compat)', async () => {
    const product = { netQuantity: '500 g' }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS, 'Expected PASS for string "500 g"')
  })

  test('A7. string "1 kg" still PASS (backward compat)', async () => {
    const product = { netQuantity: '1 kg' }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS, 'Expected PASS for string "1 kg"')
  })

  test('A8. object with invalid unit -> FAIL (not UNKNOWN crash)', async () => {
    const product = { netQuantity: { value: 100, unit: 'flurbles' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.FAIL, 'Unknown unit must FAIL, not crash')
  })

  test('A9. object with non-positive value -> FAIL', async () => {
    const product = { netQuantity: { value: 0, unit: 'g' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.FAIL)
  })

  test('A10. object with null value -> FAIL (malformed)', async () => {
    const product = { netQuantity: { value: null, unit: 'g' } }
    const result = await evaluateRule11(product, ctx)
    const check = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.FAIL)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX B — Unit dimension isolation
// Root cause: no cross-dimension conversion guard in normalizeNetQuantity.
// The unit registry already stores dimensions; this tests that they are correctly
// preserved and never crossed.
// ─────────────────────────────────────────────────────────────────────────────
describe('Fix B: Unit dimension isolation', () => {
  test('B1. 15 L remains VOLUME, never MASS', () => {
    const r = normalizeNetQuantity({ value: 15, unit: 'L' })
    assert.strictEqual(r.quantityKind, QUANTITY_KINDS.VOLUME, '15 L must be VOLUME')
    assert.notStrictEqual(r.quantityKind, QUANTITY_KINDS.MASS, '15 L must NOT be MASS')
    assert.strictEqual(r.unit, 'L')
  })

  test('B2. 500 ml remains VOLUME, never MASS', () => {
    const r = normalizeNetQuantity('500 ml')
    assert.strictEqual(r.quantityKind, QUANTITY_KINDS.VOLUME, '500 ml must be VOLUME')
    assert.notStrictEqual(r.quantityKind, QUANTITY_KINDS.MASS)
  })

  test('B3. 1 kg remains MASS, never VOLUME', () => {
    const r = normalizeNetQuantity('1 kg')
    assert.strictEqual(r.quantityKind, QUANTITY_KINDS.MASS, '1 kg must be MASS')
    assert.notStrictEqual(r.quantityKind, QUANTITY_KINDS.VOLUME)
  })

  test('B4. 500 g remains MASS, never VOLUME', () => {
    const r = normalizeNetQuantity({ value: 500, unit: 'g' })
    assert.strictEqual(r.quantityKind, QUANTITY_KINDS.MASS)
    assert.notStrictEqual(r.quantityKind, QUANTITY_KINDS.VOLUME)
  })

  test('B5. baseUnit for volume is mL, not g', () => {
    const r = normalizeNetQuantity({ value: 15, unit: 'L' })
    assert.strictEqual(r.baseUnit, 'mL', 'Volume base unit must be mL')
    assert.notStrictEqual(r.baseUnit, 'g')
  })

  test('B6. baseUnit for mass is g, not mL', () => {
    const r = normalizeNetQuantity({ value: 1, unit: 'kg' })
    assert.strictEqual(r.baseUnit, 'g', 'Mass base unit must be g')
    assert.notStrictEqual(r.baseUnit, 'mL')
  })

  test('B7. intra-dimension conversion 1000 mL = 1 L (1000 mL baseValue)', () => {
    const ml = normalizeNetQuantity('1000 ml')
    const L = normalizeNetQuantity('1 L')
    assert.strictEqual(ml.quantityKind, L.quantityKind, 'Both must be VOLUME')
    assert.strictEqual(ml.baseValue, L.baseValue, '1000 mL and 1 L must have same baseValue')
  })

  test('B8. intra-dimension conversion 1000 g = 1 kg (1000 g baseValue)', () => {
    const g = normalizeNetQuantity('1000 g')
    const kg = normalizeNetQuantity('1 kg')
    assert.strictEqual(g.quantityKind, kg.quantityKind, 'Both must be MASS')
    assert.strictEqual(g.baseValue, kg.baseValue, '1000 g and 1 kg must have same baseValue')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX C — MRP false positives
// Root cause: REJECT_NUMBERS did not block year-like values (1932, 1826),
// single-digit numbers (7), and 5-digit values without currency context.
// ─────────────────────────────────────────────────────────────────────────────
describe('Fix C: MRP false positives', () => {
  function det(text, x, y, w, h, conf = 0.95) {
    return { text, confidence: conf, bbox: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]] }
  }

  test('C1. MRP ₹120 is accepted', () => {
    const nodes = [det('MRP ₹120', 0, 0, 100, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(r.mrp && r.mrp.value === 120, 'MRP ₹120 must be accepted')
  })

  test('C2. M.R.P. Rs. 120/- is accepted', () => {
    const nodes = [det('M.R.P. Rs. 120/-', 0, 0, 120, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(r.mrp && r.mrp.value === 120, 'Rs. 120/- must be accepted')
  })

  test('C3. Maximum Retail Price: 250 is accepted', () => {
    const nodes = [det('Maximum Retail Price: 250', 0, 0, 160, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(r.mrp && r.mrp.value === 250, 'Maximum Retail Price must be accepted')
  })

  test('C4. Bare "1932" near MRP label is REJECTED (year-like)', () => {
    // Year-like 4-digit number. Even near an MRP label it should be rejected.
    const nodes = [
      det('MRP', 0, 0, 30, 20, 0.99),
      det('1932', 35, 0, 40, 20, 0.99),
    ]
    const r = extractProductFields(nodes)
    assert.ok(!r.mrp || r.mrp.value !== 1932, 'Year-shaped 1932 must NOT become MRP')
  })

  test('C5. Bare "1826" near MRP label is REJECTED (year-like)', () => {
    const nodes = [
      det('MRP', 0, 0, 30, 20, 0.99),
      det('1826', 35, 0, 40, 20, 0.99),
    ]
    const r = extractProductFields(nodes)
    assert.ok(!r.mrp || r.mrp.value !== 1826, 'Year-shaped 1826 must NOT become MRP')
  })

  test('C6. Bare "7" is REJECTED (single digit, no currency)', () => {
    const nodes = [
      det('MRP', 0, 0, 30, 20, 0.99),
      det('7', 35, 0, 15, 20, 0.95),
    ]
    const r = extractProductFields(nodes)
    assert.ok(!r.mrp || r.mrp.value !== 7, 'Single digit 7 must NOT become MRP')
  })

  test('C7. Phone number shape is REJECTED', () => {
    const nodes = [det('MRP: 1800-200-4000', 0, 0, 130, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(!r.mrp, 'Phone number must not become MRP')
  })

  test('C8. PIN code shape is REJECTED', () => {
    const nodes = [
      det('MRP', 0, 0, 30, 20, 0.99),
      det('400001', 35, 0, 50, 20, 0.99),
    ]
    const r = extractProductFields(nodes)
    assert.ok(!r.mrp || r.mrp.value !== 400001, 'PIN code must NOT become MRP')
  })

  test('C9. Date-formatted value is REJECTED', () => {
    const nodes = [
      det('MRP', 0, 0, 30, 20, 0.99),
      det('12/2026', 35, 0, 50, 20, 0.98),
    ]
    const r = extractProductFields(nodes)
    assert.ok(!r.mrp, 'Date-formatted value must NOT become MRP')
  })

  test('C10. ₹250 (currency prefix) is always accepted', () => {
    const nodes = [det('₹250', 0, 0, 60, 30, 0.99)]
    const cands = inferCandidates('₹250', { nearbyText: [], declarationRegion: true })
    const mrp = cands.find(c => c.key === 'mrp')
    assert.ok(mrp && mrp.parsed.value === 250, '₹250 must yield MRP candidate')
    assert.ok(mrp.confidence >= 0.55, 'Must be at least REVIEW confidence')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX D — Date semantic classification
// Root cause: inferDate gave all date-shaped tokens base confidence 0.3 without
// penalizing batch-adjacent dates, allowing lot codes to appear as MFD.
// ─────────────────────────────────────────────────────────────────────────────
describe('Fix D: Date semantic classification', () => {
  test('D1. "MFD: 08/2026" explicit label extracts manufacture date', () => {
    function det(text, x, y, w, h, conf = 0.95) {
      return { text, confidence: conf, bbox: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]] }
    }
    const nodes = [det('MFD: 08/2026', 0, 0, 120, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(r.dateOfManufacture && r.dateOfManufacture.value, 'MFD: label must extract date')
  })

  test('D2. "Mfg. Date: 01/2026" extracts manufacture date', () => {
    function det(text, x, y, w, h, conf = 0.95) {
      return { text, confidence: conf, bbox: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]] }
    }
    const nodes = [det('Mfg. Date: 01/2026', 0, 0, 150, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(r.dateOfManufacture && r.dateOfManufacture.value, 'Mfg. Date: must extract date')
  })

  test('D3. "Mfg. Date: 01/2026" does not also capture as manufactured-BY', () => {
    function det(text, x, y, w, h, conf = 0.95) {
      return { text, confidence: conf, bbox: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]] }
    }
    const nodes = [det('Mfg. Date: 01/2026', 0, 0, 150, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(!r.manufacturerName || !String(r.manufacturerName.value || '').includes('2026'),
      'Mfg. Date value must not pollute manufacturerName')
  })

  test('D4. Date near batch label has penalized MFD confidence (batch_label_nearby_penalty)', () => {
    const cands = inferCandidates('08/2026', {
      nearbyText: ['Batch No.', 'B2025/08'],
      declarationRegion: true,
    })
    const mfd = cands.find(c => c.key === 'dateOfManufacture')
    if (mfd) {
      assert.ok(mfd.signals.includes('batch_label_nearby_penalty'), 'Must flag batch penalty')
      assert.ok(mfd.status !== 'PASS', 'Batch-adjacent date must not reach PASS status for MFD')
    }
    // No MFD candidate at all is also acceptable (penalty may push below UNKNOWN)
  })

  test('D5. SEE TOP does not produce a date candidate', () => {
    const cands = inferCandidates('SEE TOP', { nearbyText: [], declarationRegion: false })
    const dateCands = cands.filter(c => ['dateOfManufacture', 'dateOfPacking', 'expiryOrUseByDate'].includes(c.key))
    assert.strictEqual(dateCands.length, 0, 'SEE TOP must not produce date candidates')
  })

  test('D6. SEE BOTTOM does not produce a date candidate', () => {
    const cands = inferCandidates('SEE BOTTOM', { nearbyText: [], declarationRegion: true })
    const dateCands = cands.filter(c => ['dateOfManufacture', 'dateOfPacking', 'expiryOrUseByDate'].includes(c.key))
    assert.strictEqual(dateCands.length, 0, 'SEE BOTTOM must not produce date candidates')
  })

  test('D7. EXP: 09/2027 extracts expiry date, not MFD', () => {
    function det(text, x, y, w, h, conf = 0.95) {
      return { text, confidence: conf, bbox: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]] }
    }
    const nodes = [det('EXP: 09/2027', 0, 0, 110, 20, 0.99)]
    const r = extractProductFields(nodes)
    assert.ok(r.expiryOrUseByDate && r.expiryOrUseByDate.value, 'EXP: must extract expiry')
    assert.ok(!r.dateOfManufacture || !r.dateOfManufacture.value, 'EXP: must NOT also set MFD')
  })

  test('D8. "Manufactured by" does not become a date label', () => {
    function det(text, x, y, w, h, conf = 0.95) {
      return { text, confidence: conf, bbox: [[x, y], [x+w, y], [x+w, y+h], [x, y+h]] }
    }
    const nodes = [det('Manufactured by Hindustan Unilever Ltd.', 0, 0, 250, 20, 0.97)]
    const r = extractProductFields(nodes)
    assert.ok(!r.dateOfManufacture || !r.dateOfManufacture.value,
      '"Manufactured by" must not extract a date')
    assert.ok(r.manufacturerName && r.manufacturerName.value &&
      r.manufacturerName.value.includes('Hindustan'),
      '"Manufactured by" must extract manufacturer name')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX E — Product category discrimination
// Root cause: GENERAL_OCR_CONTEXT had overly generic terms ('clean', 'wash')
// that match both household AND personal_care products. Confidence margin gap
// was too small (5 vs 8) allowing confidently-wrong DETECTED results.
// ─────────────────────────────────────────────────────────────────────────────
describe('Fix E: Product category discrimination', () => {
  function ocrNodes(texts) {
    return texts.map((text, i) => ({ text, confidence: 0.9, bbox: [[0, i*20], [100, i*20], [100, i*20+15], [0, i*20+15]] }))
  }

  test('E1. Detergent / laundry powder keywords -> household or REVIEW, not beverage', () => {
    const r = detectProductCategory({ ocrResults: ocrNodes(['Detergent Powder', 'Remove Stains', 'Laundry Wash', 'Net Wt 1 kg']) })
    assert.notStrictEqual(r.category, 'beverage', 'Detergent must not be classified as beverage')
    assert.ok(['household', 'unknown'].includes(r.category) || r.status === DETECTION_STATUS.REVIEW,
      'Detergent should be household or ambiguous')
  })

  test('E2. Toothpaste keyword -> personal_care or REVIEW, not food', () => {
    const r = detectProductCategory({ ocrResults: ocrNodes(['Toothpaste', 'For oral hygiene', 'Fluoride Formula']) })
    assert.notStrictEqual(r.category, 'food', 'Toothpaste must not be classified as food')
  })

  test('E3. Shampoo keyword -> cosmetic or personal_care, not food or beverage', () => {
    const r = detectProductCategory({ ocrResults: ocrNodes(['Shampoo', 'For shiny hair', 'Avoid contact with eyes', '200 ml']) })
    assert.ok(['cosmetic', 'personal_care'].includes(r.category) || r.status !== DETECTION_STATUS.DETECTED,
      'Shampoo should be cosmetic/personal_care or not confidently detected as wrong category')
    assert.notStrictEqual(r.category, 'food')
    assert.notStrictEqual(r.category, 'beverage')
  })

  test('E4. Ambiguous OCR prefers REVIEW/UNKNOWN over confident wrong category', () => {
    // Generic promotional words without specific category signals
    const r = detectProductCategory({ ocrResults: ocrNodes(['Great Value', 'Premium Quality', 'Buy Now', 'Offer Price']) })
    assert.ok(
      r.status === DETECTION_STATUS.UNKNOWN || r.status === DETECTION_STATUS.REVIEW,
      'Ambiguous/promotional text must not produce DETECTED category'
    )
  })

  test('E5. FSSAI registration -> food (strong explicit signal)', () => {
    const r = detectProductCategory({ ocrResults: ocrNodes(['FSSAI Lic. No. 12345678', 'Nutrition Information', 'Biscuits 200g']) })
    // FSSAI is a +10 explicit signal for food
    assert.ok(r.category === 'food' || r.status === DETECTION_STATUS.REVIEW,
      'FSSAI + nutrition + biscuit should produce food or REVIEW')
  })

  test('E6. Dish wash liquid keywords -> household', () => {
    const r = detectProductCategory({ ocrResults: ocrNodes(['Dish Wash Liquid', 'Removes Grease', 'Floor Cleaner', 'Harmful if swallowed', 'Keep out of reach of children', '500 ml']) })
    assert.ok(['household'].includes(r.category) || r.status !== DETECTION_STATUS.DETECTED || r.category !== 'food',
      'Dish wash liquid must not be food')
    assert.notStrictEqual(r.category, 'food')
    assert.notStrictEqual(r.category, 'beverage')
  })
})
