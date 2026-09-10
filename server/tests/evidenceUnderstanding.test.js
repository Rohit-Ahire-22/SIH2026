import { describe, it } from 'node:test'
import assert from 'node:assert'
import { extractEvidence, extractProductFields } from '../src/services/ocrFieldExtractionService.js'
import { inferCandidates, classifyConfidence } from '../src/services/contextualInferenceService.js'
import { EvidenceFusionService } from '../src/services/evidenceFusionService.js'

/**
 * Helper: build a structured OCR detection.
 * Normalized bbox convention: [[x1,y1],[x2,y1],[x2,y2],[x1,y2]] (top-left origin).
 */
function det(text, x, y, w, h, confidence = 0.9) {
  return { text, confidence, bbox: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] }
}

const DIMS = { imageDimensions: { width: 500, height: 1000 } }

describe('extractEvidence: provenances and explicit pass', () => {
  it('labels anchored in the same node are EXPLICIT_LABEL with PASS status', () => {
    const ocr = [
      det('MRP Rs 250.00', 100, 300, 110, 26),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.sourceType, 'EXPLICIT_LABEL')
    assert.equal(evidence.mrp.status, 'PASS')
    assert.equal(evidence.mrp.value.value, 250)
  })

  it('split-box MRP (label node and value node separate) uses SPATIAL_ASSOCIATION', () => {
    const ocr = [
      det('MRP', 100, 400, 40, 22),
      det('120', 100, 425, 35, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.sourceType, 'SPATIAL_ASSOCIATION')
    assert.equal(evidence.mrp.value.value, 120)
  })

  it('provenance sourceType is always one of the vocabulary', () => {
    const ocr = [
      det('MFD', 100, 100, 45, 22),
      det('12/2025', 100, 125, 60, 22),
      det('Made in China', 100, 200, 120, 22),
      det('Mr. Fast Customer Care 1800-000-1111', 100, 240, 210, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    const allowed = new Set(['EXPLICIT_LABEL', 'IMPLICIT_CONTEXT', 'SPATIAL_ASSOCIATION', 'VISUAL', 'MEASUREMENT', 'FUSED'])
    for (const [key, ev] of Object.entries(evidence)) {
      assert.ok(allowed.has(ev.sourceType), `${key} sourceType ${ev.sourceType} invalid`)
    }
  })
})

describe('extractEvidence: explicit labeling correctness', () => {
  it('MRP + value in one node is EXPLICIT_LABEL', () => {
    const ocr = [det('MRP Rs 250.00', 100, 300, 110, 26)]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.sourceType, 'EXPLICIT_LABEL')
    assert.equal(evidence.mrp.value.value, 250)
    assert.equal(evidence.mrp.value.currency, 'INR')
  })

  it('MRP label with value separate (same node never differs from label) — spatial association', () => {
    const ocr = [
      det('MRP', 100, 400, 40, 22),
      det('120', 100, 425, 35, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.sourceType, 'SPATIAL_ASSOCIATION')
    assert.equal(evidence.mrp.value.value, 120)
  })

  it('net quantity with label and value separate', () => {
    const ocr = [
      det('Net Qty', 100, 100, 60, 22),
      det('500 ml', 100, 125, 55, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.netQuantity.sourceType, 'SPATIAL_ASSOCIATION')
    assert.equal(evidence.netQuantity.value.value, 500)
    assert.equal(evidence.netQuantity.value.unit, 'ml')
  })

  it('dates: MFD/Mfg/Expiry/Use By/Best Before', () => {
    const ocr = [
      det('Mfg Date: 15/08/2025', 100, 100, 140, 22),
      det('Expiry: 31.12.2026', 100, 130, 120, 22),
      det('Best Before: 01/2027', 100, 160, 120, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.dateOfManufacture.value, '2025-08-15')
    assert.equal(evidence.expiryOrUseByDate.value, '2026-12-31')
  })

  it('manufacturer does not swallow the date value', () => {
    const ocr = [
      det('MFD', 100, 200, 35, 22),
      det('08/2026', 100, 225, 60, 22),
      det('Manufactured by HUL', 100, 260, 140, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.manufacturerName.value, 'HUL')
    assert.equal(evidence.dateOfManufacture.value, '2026-08-01')
  })

  it('consumer care contact extracted as OBJECT', () => {
    const ocr = [det('Customer Care: 1800-200-5000', 100, 300, 150, 22)]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.consumerCareDetails.value.phone, '1800-200-5000')
  })

  it('country of origin extracted', () => {
    const ocr = [det('Made in India', 100, 400, 90, 22)]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.countryOfOrigin.value, 'India')
  })
})

describe('extractEvidence: implicit/contextual inference (IMPLICIT_CONTEXT)', () => {
  it('bare ₹120 in declaration region becomes MRP with IMPLICIT_CONTEXT (REVIEW)', () => {
    const ocr = [
      det('Delicious Biscuits', 100, 50, 150, 26),
      det('₹120', 100, 700, 55, 26),
      det('Contains 12 biscuits', 100, 730, 150, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.sourceType, 'IMPLICIT_CONTEXT')
    assert.equal(evidence.mrp.value.value, 120)
    assert.equal(evidence.mrp.status, 'REVIEW')
    assert.ok(evidence.mrp.signals.includes('implicit_currency_symbol'))
  })

  it('bare net quantity "100 g" becomes NET_QUANTITY with IMPLICIT_CONTEXT (REVIEW)', () => {
    const ocr = [
      det('Cereal Oats', 100, 50, 90, 26),
      det('100 g', 100, 700, 50, 26),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.netQuantity.sourceType, 'IMPLICIT_CONTEXT')
    assert.equal(evidence.netQuantity.value.value, 100)
    assert.equal(evidence.netQuantity.value.unit, 'g')
    assert.equal(evidence.netQuantity.status, 'REVIEW')
  })

  it('implicit never overrides explicit evidence on the same field', () => {
    const ocr = [
      det('MRP', 100, 300, 40, 22),
      det('120', 100, 325, 35, 22),
      det('₹150', 300, 320, 50, 22), // distant competing value
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.value.value, 120)
    assert.equal(evidence.mrp.sourceType, 'SPATIAL_ASSOCIATION')
  })

  it('a single standalone date token maps to at most ONE date field', () => {
    const ocr = [
      det('Product X', 100, 50, 90, 26),
      det('08/2026', 100, 200, 60, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    const dateKeys = ['dateOfManufacture', 'dateOfPacking', 'expiryOrUseByDate']
    const present = dateKeys.filter(k => evidence[k])
    assert.ok(present.length <= 1, `expected <=1 date field, got ${present.join(',')}`)
  })

  it('weak standalone date (no label/context) is NOT stored as evidence (UNKNOWN dropped)', () => {
    const ocr = [
      det('Delicious Biscuits', 100, 50, 150, 26),
      det('08/2026', 100, 600, 60, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.dateOfManufacture, undefined)
    assert.equal(evidence.dateOfPacking, undefined)
    assert.equal(evidence.expiryOrUseByDate, undefined)
  })
})

describe('extractEvidence: fail-closed negatives', () => {
  it('100% explicit productName is REVIEW (no generic-name marker) — never fabricated', () => {
    const ocr = [
      { text: 'Vim', confidence: 0.95, bbox: [[100, 50], [200, 50], [200, 80], [100, 80]] },
      { text: 'Dishwash Gel', confidence: 0.92, bbox: [[100, 85], [250, 85], [250, 115], [100, 115]] },
      { text: 'MRP', confidence: 0.98, bbox: [[100, 400], [150, 400], [150, 425], [100, 425]] },
      { text: '120', confidence: 0.88, bbox: [[100, 430], [160, 430], [160, 460], [100, 460]] },
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.ok(evidence.productName.value, 'productName should be extracted')
    assert.equal(evidence.productName.status, 'REVIEW')
  })

  it('a phone number does NOT become MRP', () => {
    const ocr = [
      det('Customer Care: 1800-200-4000', 100, 300, 190, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp, undefined)
  })

  it('a batch code does NOT become MRP', () => {
    const ocr = [
      det('Batch: A4B5C6', 100, 300, 110, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp, undefined)
  })

  it('a bare number alone does NOT become MRP (no currency, no label)', () => {
    const ocr = [
      det('Delicious Biscuits', 100, 50, 120, 26),
      det('120', 100, 200, 35, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp, undefined)
  })

  it('a PIN code shape does NOT become net quantity or MRP', () => {
    const ocr = [
      det('PIN: 560103', 100, 300, 90, 22),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp, undefined)
    assert.equal(evidence.netQuantity, undefined)
  })

  it('ingredient quantity "500 mg" near "₹120" does not corrupt MRP detection', () => {
    const ocr = [
      det('Vitamin C', 100, 50, 90, 26),
      det('500 mg', 100, 80, 55, 22),
      det('₹120', 100, 700, 55, 26),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.value.value, 120)
  })
})

describe('inferCandidates: unit-level behavior', () => {
  it('classifyConfidence thresholds: 0.80+ PASS, 0.55+ REVIEW, else UNKNOWN', () => {
    assert.equal(classifyConfidence(0.95), 'PASS')
    assert.equal(classifyConfidence(0.80), 'PASS')
    assert.equal(classifyConfidence(0.65), 'REVIEW')
    assert.equal(classifyConfidence(0.55), 'REVIEW')
    assert.equal(classifyConfidence(0.30), 'UNKNOWN')
  })

  it('₹120 in declaration region → MRP candidate, confidence ≥ 0.55, never UNKNOWN', () => {
    const cands = inferCandidates('₹120', { nearbyText: ['Contains 12 biscuits'], declarationRegion: true, prominent: false })
    const mrp = cands.find(c => c.concept === 'MRP')
    assert.ok(mrp, 'MRP candidate expected')
    assert.ok(mrp.confidence >= 0.55)
    assert.equal(mrp.parsed.value, 120)
  })

  it('₹120 with a phone nearby is still MRP (prose phone text must not reject)', () => {
    const cands = inferCandidates('₹120', { nearbyText: ['Call 1800-200-4000'], declarationRegion: true, prominent: true })
    const mrp = cands.find(c => c.concept === 'MRP')
    assert.ok(mrp, 'MRP candidate expected')
  })

  it('bare "120" alone → no MRP candidate', () => {
    const cands = inferCandidates('120', { nearbyText: ['Delicious Biscuits'], declarationRegion: false, prominent: false })
    assert.equal(cands.find(c => c.concept === 'MRP'), undefined)
  })

  it('bare "450 mL" → net quantity candidate even without label (weight-based)', () => {
    const cands = inferCandidates('450 mL', { nearbyText: [], declarationRegion: true, prominent: true })
    const nq = cands.find(c => c.concept === 'NET_QUANTITY')
    assert.ok(nq, 'NET_QUANTITY candidate expected')
    assert.equal(nq.parsed.value, 450)
    assert.equal(nq.parsed.unit, 'ml')
  })

  it('"1800-200-4000" never yields MRP/net quantity/date', () => {
    const cands = inferCandidates('1800-200-4000', { nearbyText: [], declarationRegion: true, prominent: true })
    const concepts = cands.map(c => c.concept)
    assert.ok(!concepts.includes('MRP'))
    assert.ok(!concepts.includes('NET_QUANTITY'))
  })
})

describe('EvidenceFusionService contract (bbox-first, provenance preserved)', () => {
  it('preserves sourceType/confidence/status through fusion', () => {
    const extractedFields = {
      mrp: { value: 120, sourceType: 'IMPLICIT_CONTEXT', confidence: 0.65, status: 'REVIEW', bbox: [[10, 10], [20, 10], [20, 20], [10, 20]] },
    }
    const visualResult = {
      inferenceStatus: 'SUCCESS',
      detections: [{ label: 'pdp', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 100], [0, 100]] }],
    }
    const fused = EvidenceFusionService.fuseEvidence(extractedFields, visualResult, [])
    assert.equal(fused.fusedFields.mrp.spatialRelationToPdp, 'INSIDE')
    assert.equal(fused.fusedFields.mrp.sourceType, 'IMPLICIT_CONTEXT')
    assert.equal(fused.fusedFields.mrp.status, 'REVIEW')
    assert.equal(fused.fusedFields.mrp.confidence, 0.65)
  })

  it('review (null value) fields are carried through with UNKNOWN relation, never dropped', () => {
    const extractedFields = {
      mrp: { value: null, sourceType: 'EXPLICIT_LABEL', confidence: 0, status: 'REVIEW', rawValue: 'REVIEW', bbox: [[10, 10], [20, 10], [20, 20], [10, 20]] },
    }
    const visualResult = { inferenceStatus: 'SUCCESS', detections: [{ label: 'pdp', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 100], [0, 100]] }] }
    const fused = EvidenceFusionService.fuseEvidence(extractedFields, visualResult, [])
    assert.ok(fused.fusedFields.mrp, 'REVIEW field must not be dropped')
    assert.equal(fused.fusedFields.mrp.spatialRelationToPdp, 'UNKNOWN')
  })

  it('gracefully handles missing visual model', () => {
    const extractedFields = { mrp: { value: 100, bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] } }
    const visualResult = { inferenceStatus: 'UNAVAILABLE_MODEL_MISSING', detections: [] }
    const fused = EvidenceFusionService.fuseEvidence(extractedFields, visualResult, [])
    assert.equal(fused.visualInferenceStatus, 'UNAVAILABLE_MODEL_MISSING')
    assert.equal(fused.fusedFields.mrp.spatialRelationToPdp, 'UNKNOWN')
  })
})

describe('compliance contract preserved through extraction layer', () => {
  it('extractProductFields keeps the existing field-shape contract', () => {
    const fields = extractProductFields([
      det('MRP Rs 250.00', 100, 300, 110, 26).text,
      det('Net Quantity 500 g', 100, 340, 120, 22).text,
      det('Batch: ABC123', 100, 380, 90, 22).text,
    ])
    assert.equal(fields.mrp.value, 250)
    assert.deepEqual(fields.netQuantity.value, 500)
    assert.equal(fields.netQuantity.unit, 'g')
    assert.equal(fields.batchLotNumber.value, 'ABC123')
  })

  it('a REVIEW evidence entry can never be silently promoted to PASS by the merge', () => {
    const ocr = [
      det('Delicious Biscuits', 100, 50, 150, 26),
      det('₹190', 100, 700, 55, 26),
    ]
    const evidence = extractEvidence(ocr, DIMS)
    assert.equal(evidence.mrp.status, 'REVIEW')
  })
})