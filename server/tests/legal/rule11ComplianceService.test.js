import { test, describe } from 'node:test'
import assert from 'node:assert'
import { evaluateRule11 } from '../../src/legal/compliance/rule11ComplianceService.js'
import { COMPLIANCE_STATUS } from '../../src/legal/compliance/complianceTypes.js'

describe('rule11ComplianceService', () => {
  const defaultContext = {
    consumerType: 'RETAIL',
    confirmedAbsentFields: []
  }

  test('net quantity PASSes if valid', async () => {
    const product = { netQuantity: '500 g' }
    const result = await evaluateRule11(product, defaultContext)
    
    assert.ok(Array.isArray(result.checks), 'evaluateRule11 must return a result object with a checks array')
    const qtyResult = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(qtyResult.status, COMPLIANCE_STATUS.PASS)
  })

  test('net quantity REVIEW if missing but not confirmed absent', async () => {
    const product = { netQuantity: null }
    const result = await evaluateRule11(product, defaultContext)
    
    const qtyResult = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(qtyResult.status, COMPLIANCE_STATUS.REVIEW)
    assert.strictEqual(qtyResult.reason, 'Net quantity declaration missing from OCR evidence. May be present but undetected.')
  })

  test('net quantity FAIL if confirmed absent', async () => {
    const product = { netQuantity: null }
    const context = { consumerType: 'RETAIL', confirmedAbsentFields: ['netQuantity'] }
    const result = await evaluateRule11(product, context)
    
    const qtyResult = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(qtyResult.status, COMPLIANCE_STATUS.FAIL)
    assert.strictEqual(qtyResult.reason, 'Net quantity declaration is explicitly confirmed missing.')
  })

  test('net quantity FAIL if invalid', async () => {
    const product = { netQuantity: 'abc kg' }
    const result = await evaluateRule11(product, defaultContext)
    
    const qtyResult = result.checks.find(r => r.ruleId === 'LMPC-RULE11-netQuantityExpression')
    assert.strictEqual(qtyResult.status, COMPLIANCE_STATUS.FAIL)
    assert.ok(qtyResult.reason.includes('invalid or malformed'))
  })

  test('MPE rule is REVIEW if physical measurement unavailable', async () => {
    const product = { netQuantity: '500 g' } // no observedQuantity
    const result = await evaluateRule11(product, defaultContext)
    
    const mpeResult = result.checks.find(r => r.ruleId === 'LMPC-SCHEDULE1-mpe')
    assert.strictEqual(mpeResult.status, COMPLIANCE_STATUS.REVIEW)
    assert.strictEqual(mpeResult.evidence[0].source, 'MISSING_MEASUREMENT')
  })

  test('MPE rule is REVIEW if physical measurement available but thresholds unverified', async () => {
    const product = { netQuantity: '500 g', observedQuantity: '502 g' }
    const result = await evaluateRule11(product, defaultContext)
    
    const mpeResult = result.checks.find(r => r.ruleId === 'LMPC-SCHEDULE1-mpe')
    assert.strictEqual(mpeResult.status, COMPLIANCE_STATUS.REVIEW)
    assert.strictEqual(mpeResult.evidence[0].source, 'UNVERIFIED_MPE_TOLERANCE')
  })
})
