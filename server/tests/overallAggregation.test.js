import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getOverallComplianceStatus } from '../src/services/analysisOrchestrationService.js'

describe('Overall Aggregation (getOverallComplianceStatus)', () => {
  it('[PASS] -> COMPLIANT', () => {
    assert.strictEqual(getOverallComplianceStatus(['PASS']), 'COMPLIANT')
  })

  it('[PASS, PASS] -> COMPLIANT', () => {
    assert.strictEqual(getOverallComplianceStatus(['PASS', 'PASS']), 'COMPLIANT')
  })

  it('[PASS, NOT_APPLICABLE] -> COMPLIANT', () => {
    assert.strictEqual(getOverallComplianceStatus(['PASS', 'NOT_APPLICABLE']), 'COMPLIANT')
  })

  it('[PASS, REVIEW] -> REVIEW', () => {
    assert.strictEqual(getOverallComplianceStatus(['PASS', 'REVIEW']), 'REVIEW')
  })

  it('[PASS, PENDING] -> REVIEW', () => {
    assert.strictEqual(getOverallComplianceStatus(['PASS', 'PENDING']), 'REVIEW')
  })

  it('[PASS, UNKNOWN] -> REVIEW', () => {
    assert.strictEqual(getOverallComplianceStatus(['PASS', 'UNKNOWN']), 'REVIEW')
  })

  it('[REVIEW, NOT_APPLICABLE] -> REVIEW', () => {
    assert.strictEqual(getOverallComplianceStatus(['REVIEW', 'NOT_APPLICABLE']), 'REVIEW')
  })

  it('[FAIL, PASS] -> NON_COMPLIANT', () => {
    assert.strictEqual(getOverallComplianceStatus(['FAIL', 'PASS']), 'NON_COMPLIANT')
  })

  it('[FAIL, REVIEW] -> NON_COMPLIANT', () => {
    assert.strictEqual(getOverallComplianceStatus(['FAIL', 'REVIEW']), 'NON_COMPLIANT')
  })

  it('[NOT_APPLICABLE] -> REVIEW', () => {
    assert.strictEqual(getOverallComplianceStatus(['NOT_APPLICABLE']), 'REVIEW')
  })

  it('[] -> REVIEW', () => {
    assert.strictEqual(getOverallComplianceStatus([]), 'REVIEW')
  })

  it('[UNEXPECTED_STATUS, PASS] -> REVIEW', () => {
    assert.strictEqual(getOverallComplianceStatus(['WEIRD_STATE', 'PASS']), 'REVIEW')
  })
})

describe('Rule-Level worstStatus behavior simulation', () => {
  // Simulating the fixed behavior from the compliance services
  function statusRank(status) {
    const order = { 'FAIL': 1, 'REVIEW': 2, 'PENDING': 2, 'PASS': 3, 'NOT_APPLICABLE': 4 }
    return order[status] ?? 2
  }

  function worstStatus(statuses) {
    const executed = statuses.filter((s) => s !== 'NOT_APPLICABLE')
    if (executed.length === 0) return 'NOT_APPLICABLE'
    return executed.sort((a, b) => statusRank(a) - statusRank(b))[0]
  }

  it('PASS + PENDING must not resolve to PASS', () => {
    assert.notStrictEqual(worstStatus(['PASS', 'PENDING']), 'PASS')
    assert.strictEqual(worstStatus(['PASS', 'PENDING']), 'PENDING') // Sorts PENDING before PASS
  })

  it('PASS + UNKNOWN must not resolve to PASS', () => {
    assert.notStrictEqual(worstStatus(['PASS', 'UNKNOWN']), 'PASS')
    assert.strictEqual(worstStatus(['PASS', 'UNKNOWN']), 'UNKNOWN') // Falls back to rank 2
  })

  it('PASS + REVIEW must not resolve to PASS', () => {
    assert.notStrictEqual(worstStatus(['PASS', 'REVIEW']), 'PASS')
    assert.strictEqual(worstStatus(['PASS', 'REVIEW']), 'REVIEW')
  })
  
  it('PASS + FAIL must resolve to FAIL', () => {
    assert.strictEqual(worstStatus(['PASS', 'FAIL']), 'FAIL')
  })
  
  it('FAIL + REVIEW must resolve to FAIL', () => {
    assert.strictEqual(worstStatus(['FAIL', 'REVIEW']), 'FAIL')
  })
})
