/**
 * Stage 7.12 Adversarial Accuracy & False-Positive Hardening Tests
 *
 * Generalised regression coverage (NO product-specific rules) for every
 * root-cause defect reproduced in the Stage 7.11 live validation:
 *
 *   MP  - MRP false positives  (date fragments, licence/sku codes, bare
 *         single-digit, trailing-hyphen reg numbers, barcode-collateral
 *         rejection of a real rupee amount, ambiguous competing values)
 *   DT  - Date false positives  (money values read as dates, toll-free
 *         numbers read as MFD, impossible/code-shaped "33-01-2025" values,
 *         "Manufactured&Marketed by" anchoring a date, token duplication
 *         under Packed & Use-By)
 *   LT  - Batch/lot false positives (stray label & prose tokens, phone,
 *         quantity and short-numeric shapes under a lot label)
 *   XF  - Cross-field integrity  (competing candidates resolve to REVIEW,
 *         never to a confident guess; date-chain reconciliation is
 *         downgrade-only and fail-closed)
 *   UN  - Unit-safety barrier    (density / unit-price shapes never become
 *         net quantities; mass and volume kinds remain distinct)
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { classifyMrpValue, classifyQuantityValue } from '../src/services/declarationConceptService.js'
import { inferCandidates } from '../src/services/contextualInferenceService.js'
import { extractProductFields, extractEvidence, DATE_LABELS } from '../src/services/ocrFieldExtractionService.js'

// Synthetic OCR node helper (bbox keeps geometry/size logic deterministic).
const node = (text, y = 0) => ({ text, confidence: 0.9, bbox: [[0, y], [400, y], [400, y + 20], [0, y + 20]] })

const VALUE = {
  mrp: (f) => (f ? f.value : undefined),
  netQuantity: (f) => (f ? f.value : undefined),
  dateOfManufacture: (f) => (f ? f.value : undefined),
  dateOfPacking: (f) => (f ? f.value : undefined),
  expiryOrUseByDate: (f) => (f ? f.value : undefined),
  batchLotNumber: (f) => (f ? f.value : undefined),
}

// ─────────────────────────────────────────────────────────────────────────────
// MP — MRP adversarial hardening
// ─────────────────────────────────────────────────────────────────────────────
describe('MP: MRP money classification is strict', () => {
  test('MP1. "7/-" is a valid single-digit MRP (money-formatted path)', () => {
    const r = classifyMrpValue('7/-')
    assert.equal(r.ok, true)
    assert.equal(r.parsed.value, 7)
  })

  test('MP2. "129/-" parses as 129', () => {
    const r = classifyMrpValue('129/-')
    assert.equal(r.ok, true)
    assert.equal(r.parsed.value, 129)
  })

  test('MP3. "07/25" (MM/YY fragment) is NOT a money value', () => {
    assert.equal(classifyMrpValue('07/25').ok, false)
  })

  test('MP4. trailing-hyphen "13-" (reg licence fragment) is NOT money', () => {
    assert.equal(classifyMrpValue('13-').ok, false)
  })

  test('MP5. unit-price ratio "0.61/ml" is NOT money', () => {
    assert.equal(classifyMrpValue('0.61/ml').ok, false)
  })

  test('MP6. rupee symbol still parses ("₹7", "₹129.50")', () => {
    assert.equal(classifyMrpValue('₹7').parsed.value, 7)
    assert.equal(classifyMrpValue('MRP: ₹129.50').parsed.value, 129.5)
  })

  test('MP7. loose "7/-=10" slash shapes remain money', () => {
    assert.equal(classifyMrpValue('7/-=10').parsed.value, 7)
  })
})

describe('MP: MRP extraction hardening on real evidence strings', () => {
  test('MP8. 9-digit SKU under MRP ("MRPRs A 013000101") -> no confident MRP', () => {
    const f = extractProductFields([node('MRPRs A 013000101')])
    assert.equal(VALUE.mrp(f.mrp), undefined)
  })

  test('MP9. full OCR node with internal barcode still yields the rupee amount', () => {
    const inf = inferCandidates('BSTT342 129/-.0.61/ml 8901396602491', {
      nearbyText: ['MRP NCL', '.INCL. OF ALL TAXES'],
      declarationRegion: true,
      prominent: true,
    })
    const m = inf.find((c) => c.key === 'mrp')
    assert.equal(m && m.parsed.value, 129)
  })

  test('MP10. bare number near a price label is capped to REVIEW, never PASS', () => {
    const inf = inferCandidates('7', { nearbyText: ['MRP.'], declarationRegion: true, prominent: true })
    const m = inf.find((c) => c.key === 'mrp')
    assert.equal(m && m.status, 'REVIEW')
    assert.equal(m && m.signals.includes('bare_number_capped_review'), true)
    assert.equal(m && m.confidence, 0.55)
    assert.equal(m && m.signals.includes('nearby_money_candidate'), false)
  })

  test('MP11. "MRP.₹7" + full "129/-" code node resolves explicit 129 (real 010 layout)', () => {
    const dettol = [
      node('MRP.₹7(INCL. OF ALL TAXES)', 0),
      node('BSTT342 129/-.0.61/ml 8901396602491', 80),
    ]
    const exp = extractProductFields(dettol)
    assert.equal(VALUE.mrp(exp.mrp), 129)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DT — Date false-positive hardening
// ─────────────────────────────────────────────────────────────────────────────
describe('DT: money and code shapes are never dates', () => {
  test('DT1. "USE BY: NFD: Rs.5.00 (INCL.OF ALL TAXES)" -> no expiry (money-as-date)', () => {
    const f = extractProductFields([node('USE BY: NFD: Rs.5.00 (INCL.OF ALL TAXES)')])
    assert.equal(VALUE.expiryOrUseByDate(f.expiryOrUseByDate), undefined)
  })

  test('DT2. "MFD. TOLL FREE:1800-10-22-221" -> no mfd (toll-free as date)', () => {
    const f = extractProductFields([node('MFD. TOLL FREE:1800-10-22-221')])
    assert.equal(VALUE.dateOfManufacture(f.dateOfManufacture), undefined)
  })

  test('DT3. impossible/code-shaped "MFD. 33-01-2025" is not a manufacture date', () => {
    const f = extractProductFields([node('MFD. 33-01-2025')])
    assert.equal(VALUE.dateOfManufacture(f.dateOfManufacture), undefined)
  })

  test('DT4. a real full date under MFD is preserved', () => {
    const f = extractProductFields([node('MFD. 28-08-2026')])
    assert.equal(VALUE.dateOfManufacture(f.dateOfManufacture), '2026-08-28')
  })

  test('DT5. "USE BY: 08/2026" month-year date is preserved as a date', () => {
    const f = extractProductFields([node('USE BY: 08/2026')])
    assert.equal(VALUE.expiryOrUseByDate(f.expiryOrUseByDate), '2026-08-01')
  })
})

describe('DT: manufacture-date label disambiguation', () => {
  test('DT6. "Manufactured&Marketed by" is not a manufacture-date anchor', () => {
    assert.equal(DATE_LABELS.dateOfManufacture.test('Manufactured&Marketed by:'), false)
  })

  test('DT7. "Manufactured by" is not a manufacture-date anchor', () => {
    assert.equal(DATE_LABELS.dateOfManufacture.test('Manufactured by'), false)
  })

  test('DT8. "MFD. BY" is not a manufacture-date anchor', () => {
    assert.equal(DATE_LABELS.dateOfManufacture.test('MFD. BY'), false)
    assert.equal(DATE_LABELS.dateOfManufacture.test('MFD.BY'), false)
  })

  test('DT9. explicit manufacture-date labels still anchor', () => {
    assert.equal(DATE_LABELS.dateOfManufacture.test('MFD. 28-08-2026'), true)
    assert.equal(DATE_LABELS.dateOfManufacture.test('Mfg. Date: 08/2026'), true)
    assert.equal(DATE_LABELS.dateOfManufacture.test('Manufacturing Date: 08/2026'), true)
    assert.equal(DATE_LABELS.dateOfManufacture.test('DATE OF MANUFACTURE / Mfg Date'), true)
  })
})

describe('DT: date-chain reconciliation is downgrade-only and fail-closed', () => {
  test('DT10. duplicated token under Packed & Use-By downgrades BOTH to REVIEW', () => {
    const rows = [node('PkD: 28-07-2026', 0), node('Use By: 28-07-2026', 60)]
    const exp = extractProductFields(rows)
    const ev = extractEvidence(rows, { imageDimensions: { width: 400, height: 300 } }, exp)
    assert.equal(VALUE.dateOfPacking(exp.dateOfPacking), 'REVIEW')
    assert.equal(VALUE.expiryOrUseByDate(exp.expiryOrUseByDate), 'REVIEW')
    assert.equal(ev.dateOfPacking.status, 'REVIEW')
    assert.equal(ev.dateOfPacking.signals.includes('date_relationship_conflict_downgraded'), true)
  })

  test('DT11. expiry before manufacture (impossible chain) downgrades both', () => {
    const rows = [node('MFD. 28-08-2026', 0), node('Use By: 01-01-2026', 60)]
    const exp = extractProductFields(rows)
    extractEvidence(rows, { imageDimensions: { width: 400, height: 300 } }, exp)
    assert.equal(VALUE.dateOfManufacture(exp.dateOfManufacture), 'REVIEW')
    assert.equal(VALUE.expiryOrUseByDate(exp.expiryOrUseByDate), 'REVIEW')
  })

  test('DT12. a healthy expiry > pack date is untouched', () => {
    const rows = [node('PkD: 01-01-2026', 0), node('Use By: 31-12-2027', 60)]
    const exp = extractProductFields(rows)
    extractEvidence(rows, { imageDimensions: { width: 400, height: 300 } }, exp)
    assert.equal(VALUE.dateOfPacking(exp.dateOfPacking), '2026-01-01')
    assert.equal(VALUE.expiryOrUseByDate(exp.expiryOrUseByDate), '2027-12-31')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LT — Batch/lot false-positive hardening
// ─────────────────────────────────────────────────────────────────────────────
describe('LT: stray label & prose tokens under a lot anchor are rejected', () => {
  for (const [name, text, note] of [
    ['INDICATES', 'FIR TWO CHARACTERS OF THE BATCH INDICATES THE', 'no digits'],
    ['Pkd', 'Batch No.: Pkd', 'next-label capture'],
    ['M.R.P.Incl', 'B.NO. M.R.P.Incl', 'next-label capture'],
    ['MFG.DATE', 'BATCH NO MFG.DATE', 'next-label capture'],
    ['and', 'Lot No.: and', 'divider word'],
  ]) {
    test(`LT1. "${name}" (${note}) -> no batch lot`, () => {
      const f = extractProductFields([node(text)])
      assert.equal(VALUE.batchLotNumber(f.batchLotNumber), undefined)
    })
  }
})

describe('LT: shape negatives are rejected, valid lot codes preserved', () => {
  test('LT2. phone under a lot anchor -> rejected', () => {
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Lot No.: 1800-466-1234')]).batchLotNumber), undefined)
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Batch: 9876543210')]).batchLotNumber), undefined)
  })

  test('LT3. quantity-shaped value (42g) under a lot anchor -> rejected', () => {
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Batch No.: 42g')]).batchLotNumber), undefined)
  })

  test('LT4. bare short numeric count (24) under a lot anchor -> rejected', () => {
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Lot No.: 24')]).batchLotNumber), undefined)
  })

  test('LT5. valid alphanumeric codes are preserved', () => {
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Batch No.: ABC123')]).batchLotNumber), 'ABC123')
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Lot No.: X7A91')]).batchLotNumber), 'X7A91')
  })

  test('LT6. real date-like lot codes are preserved (as the lot value)', () => {
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Lot No.: 33-01-2025')]).batchLotNumber), '33-01-2025')
  })

  test('LT7. multi-digit numeric code is preserved', () => {
    assert.equal(VALUE.batchLotNumber(extractProductFields([node('Lot No.: 2424306')]).batchLotNumber), '2424306')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// XF — Cross-field integrity
// ─────────────────────────────────────────────────────────────────────────────
describe('XF: competing implicit candidates resolve to REVIEW, never a guess', () => {
  test('XF1. tight ₹7 vs 129/- competition -> REVIEW + candidate audit signals', () => {
    const nodes = [node('MAX PRICE', 0), node('₹7', 25), node('129/-', 60)]
    const ev = extractEvidence(nodes, { imageDimensions: { width: 400, height: 300 } })
    assert.equal(ev.mrp.status, 'REVIEW')
    const sig = ev.mrp.signals.join(' ')
    assert.equal(sig.includes('candidate_count:2'), true)
    assert.equal(sig.includes('competing_candidates_ambiguous'), true)
    assert.match(sig, /rejected_candidate_/)
  })

  test('XF2. a lone confident implicit MRP is not downgraded by competition', () => {
    const nodes = [node('MAXIMUM PRICE', 260), node('7/-', 285), node('PURE SOAP', 330)]
    const ev = extractEvidence(nodes, { imageDimensions: { width: 400, height: 400 } })
    // "7/-" sits in the declaration region with a nearby price word and NO
    // competing money candidate, so it must remain a single-entry PASS.
    const m = ev.mrp
    assert.equal(m.status, 'PASS')
    assert.equal(m.value.value, 7)
    assert.equal(m.signals.includes('candidate_count:1'), true)
    assert.equal(m.signals.includes('competing_candidates_ambiguous'), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// UN — Unit-safety barrier / adversarial OCR cases
// ─────────────────────────────────────────────────────────────────────────────
describe('UN: unit-price & density shapes are never net quantities', () => {
  test('UN1. "0.50g/ml" density -> not a net quantity', () => {
    const c = inferCandidates('0.50g/ml', {})
    assert.equal(c.some((x) => x.key === 'netQuantity'), false)
  })

  test('UN2. "0.61/ml" unit-price ratio -> not a net quantity (and not MRP)', () => {
    const c = inferCandidates('0.61/ml', { nearbyText: ['MRP NCL'] })
    assert.equal(c.some((x) => x.key === 'netQuantity'), false)
    assert.equal(c.some((x) => x.key === 'mrp'), false)
  })

  test('UN3. honest OCR "15 kg" remains a mass net quantity (OCR truth preserved)', () => {
    const c = inferCandidates('15 kg', {})
    const q = c.find((x) => x.key === 'netQuantity')
    assert.equal(q && q.parsed.kind, 'MASS')
    assert.equal(q && q.parsed.value, 15)
  })

  test('UN4. kg (MASS) and L (VOLUME) are never cross-converted', () => {
    const kg = classifyQuantityValue('2 kg')
    const l = classifyQuantityValue('2 L')
    assert.equal(kg.parsed.kind, 'MASS')
    assert.equal(l.parsed.kind, 'VOLUME')
    assert.notEqual(kg.parsed.kind, l.parsed.kind)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CT — Concept-type guard (SHAPE other than declared)
// ─────────────────────────────────────────────────────────────────────────────
describe('CT: one value, one meaning', () => {
  test('CT1. "13-" is neither a lot, MRP nor a date', () => {
    const f = extractProductFields([node('HULREGN.NO.BO-13-')])
    assert.equal(VALUE.batchLotNumber(f.batchLotNumber), undefined)
    assert.equal(VALUE.mrp(f.mrp), undefined)
    assert.equal(VALUE.dateOfManufacture(f.dateOfManufacture), undefined)
  })

  test('CT2. a full declaration line extracts MRP + net quantity + valid lot in one run', () => {
    const rows = [
      node('MRP: Rs 129/- (INCL. OF ALL TAXES)', 0),
      node('NET WT: 210 ml', 40),
      node('BATCH NO: ABC123', 80),
    ]
    const f = extractProductFields(rows)
    assert.equal(VALUE.mrp(f.mrp), 129)
    assert.equal(VALUE.netQuantity(f.netQuantity), 210)
    assert.equal(f.netQuantity.unit, 'ml')
    assert.equal(VALUE.batchLotNumber(f.batchLotNumber), 'ABC123')
  })
})