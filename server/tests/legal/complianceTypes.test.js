import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPLIANCE_STATUS,
  COMPLIANCE_STATUS_VALUES,
  isValidComplianceStatus,
  APPLICABILITY_STATUS,
  isValidApplicabilityStatus,
  createComplianceResult,
  validateComplianceResult,
  createLegalSource,
  createEvidence,
  LEGAL_DOMAIN_VALUES,
  PACKAGE_TYPE_VALUES,
  CONSUMER_TYPE_VALUES,
  IMPORT_STATUS_VALUES,
} from '../../src/legal/compliance/complianceTypes.js'

test('Test 16a: Compliance statuses validate PASS/FAIL/REVIEW/NOT_APPLICABLE/PENDING', () => {
  for (const status of ['PASS', 'FAIL', 'REVIEW', 'NOT_APPLICABLE', 'PENDING']) {
    assert.ok(isValidComplianceStatus(status), `${status} should be valid`)
    assert.ok(COMPLIANCE_STATUS_VALUES.includes(status))
  }
  assert.equal(isValidComplianceStatus('SUCCESS'), false)
  assert.equal(isValidComplianceStatus(null), false)
  assert.equal(COMPLIANCE_STATUS.PASS, 'PASS')
  assert.equal(COMPLIANCE_STATUS.NOT_APPLICABLE, 'NOT_APPLICABLE')
})

test('Test 16b: createComplianceResult builds valid results for every status', () => {
  for (const status of COMPLIANCE_STATUS_VALUES) {
    const result = createComplianceResult({
      ruleId: 'LMPC-RULE-6',
      status,
      reason: 'test',
      evidence: [],
      source: createLegalSource({ ruleNumber: '6' }),
    })
    assert.equal(result.status, status)
    assert.ok(validateComplianceResult(result), `${status} result should validate`)
  }
})

test('Test 16c: invalid status throws and invalid result fails validation', () => {
  assert.throws(() =>
    createComplianceResult({ ruleId: 'X', status: 'SUCCESS' }),
  )
  assert.throws(() => createComplianceResult({ status: 'PASS' }))
  assert.equal(validateComplianceResult({ ruleId: 'X', status: 'FAKE' }), false)
})

test('Test 17a: legal source carries official provenance and no evidence', () => {
  const source = createLegalSource({ ruleNumber: '6', ruleId: 'LMPC-RULE-6' })
  assert.equal(source.sourceAuthority, 'Department of Consumer Affairs')
  assert.equal(source.act, 'Legal Metrology Act, 2009')
  assert.equal(
    source.rules,
    'Legal Metrology (Packaged Commodities) Rules, 2011',
  )
  assert.equal(source.ruleNumber, '6')
  assert.equal(source.ruleId, 'LMPC-RULE-6')
  assert.equal(source.verified, true)
  assert.equal('value' in source, false)
  assert.equal('field' in source, false)
  assert.equal('bbox' in source, false)
})

test('Test 17b: evidence stays separate from legal source provenance', () => {
  const evidence = [
    createEvidence({
      field: 'mrp',
      value: 250,
      source: 'ocr',
      bbox: [[10, 20], [30, 20], [30, 40], [10, 40]],
    }),
  ]
  const source = createLegalSource({ ruleNumber: '6' })
  const result = createComplianceResult({
    ruleId: 'LMPC-RULE-6',
    status: COMPLIANCE_STATUS.REVIEW,
    reason: 'review needed',
    evidence,
    source,
  })

  assert.ok(validateComplianceResult(result))
  assert.notDeepEqual(result.evidence, result.source)
  assert.equal(result.source.sourceAuthority, 'Department of Consumer Affairs')
  assert.equal(result.evidence[0].field, 'mrp')
  assert.equal(result.evidence[0].value, 250)
  assert.equal(result.evidence[0].source, 'ocr')
  assert.deepEqual(result.evidence[0].bbox, [
    [10, 20],
    [30, 20],
    [30, 40],
    [10, 40],
  ])
  // Prove separation: source contains no product evidence and evidence has no
  // legal provenance fields.
  assert.equal('value' in result.source, false)
  assert.equal('field' in result.source, false)
  assert.equal('ruleNumber' in result.evidence[0], false)
  assert.equal('sourceAuthority' in result.evidence[0], false)
})

test('Applicability status tri-state helpers work', () => {
  assert.equal(APPLICABILITY_STATUS.APPLICABLE, 'APPLICABLE')
  assert.equal(APPLICABILITY_STATUS.NOT_APPLICABLE, 'NOT_APPLICABLE')
  assert.equal(APPLICABILITY_STATUS.REVIEW, 'REVIEW')
  for (const value of Object.values(APPLICABILITY_STATUS)) {
    assert.ok(isValidApplicabilityStatus(value))
  }
  assert.equal(isValidApplicabilityStatus('APPLICABLE?'), false)
})

test('Special-domain identifiers are available without invented requirements', () => {
  assert.deepEqual(LEGAL_DOMAIN_VALUES, [
    'GENERAL_LMPC',
    'FOOD',
    'MEDICAL_DEVICE',
    'ELECTRONIC_PRODUCT',
    'PAN_MASALA',
    'OTHER',
  ])
  assert.ok(PACKAGE_TYPE_VALUES.includes('GIFT'))
  assert.ok(PACKAGE_TYPE_VALUES.includes('UNKNOWN'))
  assert.ok(CONSUMER_TYPE_VALUES.includes('INDUSTRIAL'))
  assert.ok(CONSUMER_TYPE_VALUES.includes('INSTITUTIONAL'))
  assert.ok(IMPORT_STATUS_VALUES.includes('IMPORTED'))
  assert.ok(IMPORT_STATUS_VALUES.includes('DOMESTIC'))
  assert.ok(IMPORT_STATUS_VALUES.includes('UNKNOWN'))
})