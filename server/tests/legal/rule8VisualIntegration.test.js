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

  it('returns REVIEW for pdpLocation when visual model is missing', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'UNAVAILABLE_MODEL_MISSING',
      pdpDetected: false
    }

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      fusedEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const pdpCheck = result.checks.find(c => c.ruleId === 'LMPC-RULE8-pdpLocation')
    assert.strictEqual(pdpCheck.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(pdpCheck.reason.includes('Safe fallback to REVIEW'))
  })

  it('returns PASS for pdpLocation when PDP is confidently detected', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpBbox: [[0,0], [10,0], [10,10], [0,10]]
    }

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      fusedEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const pdpCheck = result.checks.find(c => c.ruleId === 'LMPC-RULE8-pdpLocation')
    assert.strictEqual(pdpCheck.status, COMPLIANCE_STATUS.PASS)
  })

  it('returns PASS for declarationPlacement when declarations are INSIDE PDP', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpBbox: [[0,0], [100,0], [100,100], [0,100]],
      fusedFields: {
        mrp: { value: '100', spatialRelationToPdp: 'INSIDE' }
      }
    }

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      fusedEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const placementCheck = result.checks.find(c => c.ruleId === 'LMPC-RULE8-declarationPlacement')
    assert.strictEqual(placementCheck.status, COMPLIANCE_STATUS.PASS)
    assert.ok(placementCheck.reason.includes('Visual evidence confirms declarations (mrp) are wholly located on the PDP'))
  })

  it('returns REVIEW for declarationPlacement when declarations are PARTIAL to PDP', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpBbox: [[0,0], [100,0], [100,100], [0,100]],
      fusedFields: {
        mrp: { value: '100', spatialRelationToPdp: 'PARTIAL' }
      }
    }

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      fusedEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const placementCheck = result.checks.find(c => c.ruleId === 'LMPC-RULE8-declarationPlacement')
    assert.strictEqual(placementCheck.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(placementCheck.reason.includes('partially intersect the PDP boundary'))
  })

  it('returns REVIEW for declarationPlacement when declarations are OUTSIDE PDP', () => {
    const fusedEvidence = {
      visualInferenceStatus: 'SUCCESS',
      pdpDetected: true,
      pdpBbox: [[0,0], [100,0], [100,100], [0,100]],
      fusedFields: {
        mrp: { value: '100', spatialRelationToPdp: 'OUTSIDE' }
      }
    }

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      fusedEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const placementCheck = result.checks.find(c => c.ruleId === 'LMPC-RULE8-declarationPlacement')
    assert.strictEqual(placementCheck.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(placementCheck.reason.includes('are outside the PDP'))
  })
})
