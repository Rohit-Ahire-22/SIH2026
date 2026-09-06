import { test, describe } from 'node:test'
import assert from 'node:assert'
import { evaluateMPE } from '../../src/legal/compliance/mpeService.js'
import { COMPLIANCE_STATUS } from '../../src/legal/compliance/complianceTypes.js'

describe('mpeService', () => {
  test('returns REVIEW if physical quantity is unavailable', () => {
    const res = evaluateMPE({
      declaredQuantity: '500 g',
      observedQuantity: 'NOT_AVAILABLE',
      ruleReference: { act: 'Test' }
    })
    
    assert.strictEqual(res.status, COMPLIANCE_STATUS.REVIEW)
    assert.strictEqual(res.evidence[0].type, 'MISSING_MEASUREMENT')
  })

  test('returns FAIL if observed quantity is invalid', () => {
    const res = evaluateMPE({
      declaredQuantity: '500 g',
      observedQuantity: 'abc kg',
      ruleReference: { act: 'Test' }
    })
    
    assert.strictEqual(res.status, COMPLIANCE_STATUS.FAIL)
    assert.strictEqual(res.evidence[0].type, 'INVALID_QUANTITY_FORMAT')
  })

  test('returns FAIL if quantities are incompatible', () => {
    const res = evaluateMPE({
      declaredQuantity: '500 g',
      observedQuantity: '500 mL',
      ruleReference: { act: 'Test' }
    })
    
    assert.strictEqual(res.status, COMPLIANCE_STATUS.FAIL)
    assert.strictEqual(res.evidence[0].type, 'QUANTITY_KIND_MISMATCH')
  })

  test('returns REVIEW for MPE tolerance when both quantities are valid (no invented MPE values)', () => {
    const res = evaluateMPE({
      declaredQuantity: '500 g',
      observedQuantity: '495 g',
      ruleReference: { act: 'Test' }
    })
    
    assert.strictEqual(res.status, COMPLIANCE_STATUS.REVIEW)
    assert.strictEqual(res.error.value, -5)
    assert.strictEqual(res.error.unit, 'g')
    assert.strictEqual(res.permissibleError.value, null)
    assert.strictEqual(res.evidence[0].type, 'UNVERIFIED_MPE_TOLERANCE')
  })
})
