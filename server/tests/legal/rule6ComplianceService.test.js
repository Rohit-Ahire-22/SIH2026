import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRule6, EVIDENCE_STATE } from '../../src/legal/compliance/rule6ComplianceService.js'
import {
  getRule6Clauses,
  getRule6ClauseById,
  getRule6ClausesForDate,
  filterRule6ClausesByDate,
  RULE_6_CLAUSE_COUNT,
  AUTOMATION_LEVELS,
} from '../../src/legal/rules/lmpcRule6Clauses.js'
import { getApplicableRules } from '../../src/legal/rules/ruleRegistry.js'

function retailProduct(overrides = {}) {
  return {
    productName: 'Choco Biscuits',
    manufacturerName: 'Acme Foods Ltd',
    manufacturerAddress: '12 MG Road, Mumbai, Maharashtra 400001',
    commonGenericName: 'Biscuits',
    netQuantity: { value: 500, unit: 'g' },
    dateOfManufacture: '2025-04-01',
    dateOfPacking: '2026-08-10',
    expiryOrUseByDate: '2026-12-31',
    countryOfOrigin: 'India',
    consumerCareDetails: { phone: '1800-200-1234' },
    mrp: 250,
    dimensions: '20 x 12 x 6 cm',
    unitSalePrice: 0.5,
    ...overrides,
  }
}

function retailContext(overrides = {}) {
  return {
    consumerType: 'RETAIL',
    importStatus: 'DOMESTIC',
    packageType: 'STANDARD',
    domain: 'FOOD',
    commodityType: 'Biscuits',
    expiryRequired: true,
    dimensionsApplicable: true,
    unitSalePriceApplicable: true,
    ...overrides,
  }
}

function getCheck(result, ruleId) {
  const check = result.checks.find((c) => c.ruleId === ruleId)
  assert.ok(check, `check ${ruleId} should be present`)
  return check
}

test('Test 1: Complete domestic retail package -> overall PASS with pass/not-applicable checks', () => {
  const result = evaluateRule6({
    product: retailProduct(),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })

  assert.equal(result.status, 'PASS')
  assert.equal(result.ruleNumber, '6')
  assert.equal(result.asOfDate, '2026-09-05')
  assert.equal(getCheck(result, 'LMPC-RULE6-mrp').status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-netQuantity').status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-manufacturerName').status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-countryOfOrigin').status, 'NOT_APPLICABLE')
  assert.equal(getCheck(result, 'LMPC-RULE6-commonGenericName').status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-consumerCare').status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-dimensions').status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-unitSalePrice').status, 'PASS')
})

test('Test 2: Imported retail package with country of origin -> country PASS, overall PASS', () => {
  const result = evaluateRule6({
    product: retailProduct(),
    context: retailContext({ importStatus: 'IMPORTED' }),
    asOfDate: '2026-09-05',
  })
  assert.equal(result.status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-countryOfOrigin').status, 'PASS')
})

test('Test 3: Imported package without sufficient country-of-origin evidence -> REVIEW, never FAIL', () => {
  const result = evaluateRule6({
    product: retailProduct({ countryOfOrigin: undefined }),
    context: retailContext({ importStatus: 'IMPORTED' }),
    asOfDate: '2026-09-05',
  })
  const check = getCheck(result, 'LMPC-RULE6-countryOfOrigin')
  assert.equal(check.status, 'REVIEW')
  assert.notEqual(check.status, 'FAIL')
  assert.match(check.reason, /cannot establish|insufficient/i)
  assert.equal(result.status, 'REVIEW')
})

test('Test 4: Unknown import status -> REVIEW (never assumed and never FAIL)', () => {
  const result = evaluateRule6({
    product: retailProduct(),
    context: retailContext({ importStatus: 'UNKNOWN' }),
    asOfDate: '2026-09-05',
  })
  const check = getCheck(result, 'LMPC-RULE6-countryOfOrigin')
  assert.equal(check.status, 'REVIEW')
  assert.match(check.reason, /import\s?status/i)
})

test('Test 5: Missing MRP evidence -> REVIEW, not FAIL', () => {
  const result = evaluateRule6({
    product: retailProduct({ mrp: undefined }),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(result, 'LMPC-RULE6-mrp').status, 'REVIEW')
  assert.equal(result.status, 'REVIEW')
  assert.equal(result.checks.some((c) => c.status === 'FAIL'), false)
})

test('Test 6: Missing net quantity -> REVIEW, not FAIL', () => {
  const result = evaluateRule6({
    product: retailProduct({ netQuantity: undefined }),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(result, 'LMPC-RULE6-netQuantity').status, 'REVIEW')
  assert.equal(result.checks.some((c) => c.status === 'FAIL'), false)
})

test('Test 7: Invalid net quantity structure -> FAIL', () => {
  const zero = evaluateRule6({
    product: retailProduct({ netQuantity: { value: 0, unit: 'g' } }),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(zero, 'LMPC-RULE6-netQuantity').status, 'FAIL')

  const badUnit = evaluateRule6({
    product: retailProduct({ netQuantity: { value: 500, unit: '' } }),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(badUnit, 'LMPC-RULE6-netQuantity').status, 'FAIL')
})

test('Test 8: Manufacturer evidence behavior (present/absent/confirmed absent)', () => {
  const present = evaluateRule6({
    product: retailProduct(),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(present, 'LMPC-RULE6-manufacturerName').status, 'PASS')

  const missing = evaluateRule6({
    product: retailProduct({ manufacturerName: undefined, manufacturerAddress: undefined }),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(missing, 'LMPC-RULE6-manufacturerName').status, 'REVIEW')
  assert.equal(getCheck(missing, 'LMPC-RULE6-manufacturerAddress').status, 'REVIEW')

  const confirmed = evaluateRule6({
    product: retailProduct({ manufacturerName: undefined }),
    context: retailContext({ confirmedAbsentFields: ['manufacturerName'] }),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(confirmed, 'LMPC-RULE6-manufacturerName').status, 'FAIL')
})

test('Test 9: Consumer care evidence behavior', () => {
  const ok = evaluateRule6({
    product: retailProduct(),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(ok, 'LMPC-RULE6-consumerCare').status, 'PASS')

  const absent = evaluateRule6({
    product: retailProduct({ consumerCareDetails: undefined }),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(absent, 'LMPC-RULE6-consumerCare').status, 'REVIEW')

  const confirmed = evaluateRule6({
    product: retailProduct({ consumerCareDetails: undefined }),
    context: retailContext({ confirmedAbsentFields: ['consumerCareDetails'] }),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(confirmed, 'LMPC-RULE6-consumerCare').status, 'FAIL')
})

test('Test 10: Manufacturing / packing date evidence', () => {
  const result = evaluateRule6({
    product: retailProduct(),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(result, 'LMPC-RULE6-dateOfManufacture').status, 'PASS')
  assert.equal(getCheck(result, 'LMPC-RULE6-dateOfPacking').status, 'PASS')

  const absent = evaluateRule6({
    product: retailProduct({ dateOfManufacture: undefined, dateOfPacking: undefined }),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(absent, 'LMPC-RULE6-dateOfManufacture').status, 'REVIEW')
  assert.equal(getCheck(absent, 'LMPC-RULE6-dateOfPacking').status, 'REVIEW')
})

test('Test 11: Expiry/use-by is contextual — unknown domain vs declared requirement', () => {
  const unknownDomain = evaluateRule6({
    product: retailProduct({ expiryOrUseByDate: undefined }),
    context: retailContext({ domain: 'UNKNOWN' }),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(unknownDomain, 'LMPC-RULE6-bestBeforeUseBy').status, 'REVIEW')

  const noRequirement = evaluateRule6({
    product: retailProduct({ expiryOrUseByDate: undefined }),
    context: retailContext({ expiryRequired: undefined }),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(noRequirement, 'LMPC-RULE6-bestBeforeUseBy').status, 'REVIEW')

  const requiredAndMissing = evaluateRule6({
    product: retailProduct({ expiryOrUseByDate: undefined }),
    context: retailContext({ expiryRequired: true }),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(requiredAndMissing, 'LMPC-RULE6-bestBeforeUseBy').status, 'REVIEW')

  const confirmed = evaluateRule6({
    product: retailProduct({ expiryOrUseByDate: undefined }),
    context: retailContext({ expiryRequired: true, confirmedAbsentFields: ['expiryOrUseByDate'] }),
    asOfDate: '2026-09-05',
  })
  assert.equal(getCheck(confirmed, 'LMPC-RULE6-bestBeforeUseBy').status, 'FAIL')
})

test('Test 16: COMBINATION/GROUP/MULTI_PIECE context is carried and unit-sale-price stays REVIEW', () => {
  const result = evaluateRule6({
    product: retailProduct({ unitSalePrice: undefined }),
    context: retailContext({ packageType: 'COMBINATION', unitSalePriceApplicable: undefined }),
    asOfDate: '2026-09-05',
  })
  const check = getCheck(result, 'LMPC-RULE6-unitSalePrice')
  assert.equal(check.status, 'REVIEW')
  assert.match(check.reason, /COMBINATION/)
})

test('Test 17/18: Industrial/institutional / Rule 3 out-of-scope -> whole Rule 6 NOT_APPLICABLE', () => {
  for (const consumerType of ['INDUSTRIAL', 'INSTITUTIONAL']) {
    const result = evaluateRule6({
      product: retailProduct(),
      context: retailContext({ consumerType }),
      asOfDate: '2026-09-05',
    })
    assert.equal(result.status, 'NOT_APPLICABLE', consumerType)
    assert.deepEqual(result.checks, [])
  }
})

test('Test 19: Unknown context produces REVIEW overall', () => {
  const result = evaluateRule6({
    product: retailProduct(),
    context: {},
    asOfDate: '2026-09-05',
  })
  assert.equal(result.status, 'REVIEW')
  assert.notEqual(result.status, 'PASS')
  assert.match(result.reason, /consumer type/i)
})

test('Insufficient OCR is never converted into FAIL without confirmed inspection', () => {
  const result = evaluateRule6({
    product: retailProduct({
      countryOfOrigin: undefined,
      mrp: undefined,
      netQuantity: undefined,
      consumerCareDetails: undefined,
      dateOfManufacture: undefined,
      dateOfPacking: undefined,
    }),
    context: retailContext({ importStatus: 'IMPORTED', expiryRequired: undefined }),
    asOfDate: '2026-09-05',
  })
  assert.equal(result.checks.some((c) => c.status === 'FAIL'), false)
  assert.ok(result.checks.filter((c) => c.status === 'REVIEW').length > 0)
  assert.equal(result.status, 'REVIEW')
})

test('Evidence stays separate from legal source provenance on every check', () => {
  const result = evaluateRule6({
    product: retailProduct(),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  const check = getCheck(result, 'LMPC-RULE6-mrp')
  assert.equal(check.source.sourceAuthority, 'Department of Consumer Affairs')
  assert.equal(check.source.act, 'Legal Metrology Act, 2009')
  assert.equal(check.source.ruleNumber, '6')
  assert.equal(check.source.verified, true)
  assert.equal(check.source.clause, '6 (maximum retail price inclusive of all taxes)')
  assert.equal('field' in check.source, false)
  assert.equal('value' in check.source, false)

  const evidence = check.evidence.find((e) => e.field === 'mrp')
  assert.equal(evidence.value, 250)
  assert.equal(evidence.source, 'ocr')
  assert.equal('ruleNumber' in evidence, false)
  assert.equal('sourceAuthority' in evidence, false)
})

test('Test 20: asOfDate filters clause versions and keeps e-commerce rules separate', () => {
  const all = getRule6ClausesForDate('2026-09-05')
  assert.equal(all.length, RULE_6_CLAUSE_COUNT)
  assert.equal(getRule6Clauses().length, RULE_6_CLAUSE_COUNT)

  const result = evaluateRule6({
    product: retailProduct(),
    context: retailContext(),
    asOfDate: '2026-09-05',
  })
  const ids = result.checks.map((c) => c.ruleId)
  assert.ok(ids.every((id) => !id.startsWith('LMPC-RULE6-10A')), 'e-commerce 6(10A) rules must stay separate from package-image rule 6')
  assert.ok(AUTOMATION_LEVELS.includes('MANUAL_REVIEW'))
  assert.equal(AUTOMATION_LEVELS.includes('LLM'), false)
})

test('Test 21: Future-dated clause versions are never active prematurely', () => {
  const futureClause = { ruleId: 'FUTURE-CLAUSE', effectiveFrom: '2027-07-01', effectiveTo: null }
  const pastVersions = filterRule6ClausesByDate([futureClause], '2026-09-05')
  assert.equal(pastVersions.length, 0)
  const activeVersions = filterRule6ClausesByDate([futureClause], '2027-07-01')
  assert.equal(activeVersions.length, 1)

  // The 2026/2027 e-commerce amendment versioning remains untouched and correct.
  assert.equal(
    getApplicableRules({ asOfDate: '2026-09-05' }).some((r) => r.ruleId === 'LMPC-RULE6-10A-2027'),
    false,
  )
  assert.equal(
    getApplicableRules({ asOfDate: '2027-07-01' }).some((r) => r.ruleId === 'LMPC-RULE6-10A-2026'),
    false,
  )
})

test('Static shape checks: evidence states and clause lookups work', () => {
  assert.equal(EVIDENCE_STATE.PRESENT, 'PRESENT')
  assert.equal(EVIDENCE_STATE.ABSENT_CONFIRMED, 'ABSENT_CONFIRMED')
  assert.equal(EVIDENCE_STATE.UNKNOWN, 'UNKNOWN')
  assert.equal(getRule6ClauseById('LMPC-RULE6-mrp').ruleId, 'LMPC-RULE6-mrp')
  assert.equal(getRule6ClauseById('NOPE'), null)
})