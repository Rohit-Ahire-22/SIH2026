import { describe, it } from 'node:test'
import assert from 'node:assert'
import { evaluateRules789 } from '../../src/legal/compliance/rule789ComplianceService.js'
import { COMPLIANCE_STATUS } from '../../src/legal/compliance/complianceTypes.js'

describe('Rule 8 Visual Integration', () => {
  const baseContext = {
    packageType: 'PRE_PACKAGED',
    consumerType: 'RETAIL',
    importStatus: 'DOMESTIC'
  }

  function getRule8Check(result, ruleKey) {
    return result.checks.find(c => c.ruleId === `LMPC-RULE8-${ruleKey}`)
  }

  // 1. PDP confidently detected + declaration fully inside
  it('PDP confidently detected + declaration fully inside -> PASS for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      pdpBbox: [0, 0, 100, 100],
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'INSIDE' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS)
    assert.ok(check.reason.includes('all extracted mandatory declarations (mrp) are confidently INSIDE'))
  })

  // 2. PDP confidently detected + declaration partially intersecting
  it('PDP confidently detected + declaration PARTIAL -> REVIEW for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      pdpBbox: [0, 0, 100, 100],
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'PARTIAL' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('PARTIAL'))
  })

  // 3. PDP confidently detected + declaration outside
  it('PDP confidently detected + declaration OUTSIDE -> REVIEW for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      pdpBbox: [0, 0, 100, 100],
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'OUTSIDE' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('OUTSIDE'))
  })

  // 4. Missing PDP detection
  it('Missing PDP detection -> REVIEW for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: false
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('PDP not detected'))
  })

  // 5. Low-confidence PDP
  it('Low-confidence PDP -> REVIEW for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.4,
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'INSIDE' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('confidence'))
  })

  // 6. Missing OCR declaration
  it('PDP confidently detected but no OCR declarations -> REVIEW for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      fusedFields: {} // Empty
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('no OCR declarations found'))
  })

  // 7. Low-confidence OCR declaration
  it('PDP confidently detected + declaration INSIDE but low OCR confidence -> REVIEW for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      fusedFields: {
        mrp: { value: '100', confidence: 0.5, spatialRelationToPdp: 'INSIDE' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('OCR declarations (mrp) have low confidence'))
  })

  // 8. PDP confidently detected + Declaration A = INSIDE, Declaration B = OUTSIDE
  it('Dangerous case: Declaration A inside, Declaration B outside -> REVIEW', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'INSIDE' },
        netQuantity: { value: '500g', confidence: 0.9, spatialRelationToPdp: 'OUTSIDE' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('declarations (netQuantity) are OUTSIDE'))
  })

  // 9. Visual model unavailable -> REVIEW
  it('Visual model unavailable -> REVIEW', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'UNAVAILABLE_MODEL_MISSING'
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('requires visual model'))
  })

  // 10. declarationPlacementEvaluation MUST NOT automatically pass
  it('declarationPlacementEvaluation ALWAYS returns REVIEW because model cannot detect obstruction', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'INSIDE' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'declarationPlacement')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('Visual model does not reliably detect obstruction'))
  })

  // 11. Unrelated/promotional OCR outside the PDP must not force REVIEW
  it('Unrelated OCR fields OUTSIDE the PDP do NOT force REVIEW when required declarations are INSIDE', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      pdpBbox: [0, 0, 100, 100],
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'INSIDE' },
        netQuantity: { value: '500g', confidence: 0.9, spatialRelationToPdp: 'INSIDE' },
        brandName: { value: 'ExcellentPro Ultra', confidence: 0.95, spatialRelationToPdp: 'OUTSIDE' },
        productName: { value: 'Magic Clean', confidence: 0.9, spatialRelationToPdp: 'OUTSIDE' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.PASS)
    assert.ok(check.reason.includes('all extracted mandatory declarations (mrp, netQuantity) are confidently INSIDE'))
  })

  // 12. Required declaration with UNKNOWN spatial relation -> REVIEW (never PASS)
  it('Required declaration with UNKNOWN spatial relation to PDP -> REVIEW for pdpLocation', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpConfidence: 0.9,
      pdpBbox: [0, 0, 100, 100],
      fusedFields: {
        mrp: { value: '100', confidence: 0.9, spatialRelationToPdp: 'INSIDE' },
        netQuantity: { value: '500g', confidence: 0.9, spatialRelationToPdp: 'UNKNOWN' }
      }
    }

    const result = evaluateRules789({ product: {}, context: baseContext, fusedEvidence, asOfDate: new Date('2026-01-01') })
    const check = getRule8Check(result, 'pdpLocation')
    assert.strictEqual(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('netQuantity'))
  })
})
