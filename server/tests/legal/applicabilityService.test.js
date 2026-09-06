import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateApplicability,
  isRuleApplicable,
  normalizeProductContext,
} from '../../src/legal/applicability/applicabilityService.js'
import { APPLICABILITY_STATUS } from '../../src/legal/compliance/complianceTypes.js'
import { getRuleById } from '../../src/legal/rules/ruleRegistry.js'
import { FOUNDATIONAL_RULES } from '../../src/legal/rules/lmpcRules.js'
import { COUNTRY_OF_ORIGIN_2026_RULE } from '../../src/legal/rules/lmpcAmendments.js'

const { APPLICABLE, NOT_APPLICABLE, REVIEW } = APPLICABILITY_STATUS

const RULE_3 = getRuleById('LMPC-RULE-3')
const RULE_6_10A_2026 = getRuleById(COUNTRY_OF_ORIGIN_2026_RULE.ruleId)

test('Test 7: Rule 3 applicability returns applicable for a retail package', () => {
  const scope = evaluateApplicability({ consumerType: 'RETAIL' })
  assert.equal(scope.status, APPLICABLE)
  assert.equal(scope.scope.chapterII, true)
  assert.deepEqual(scope.missingContext, [])

  const ruleResult = isRuleApplicable(RULE_3, { consumerType: 'RETAIL' })
  assert.equal(ruleResult.status, APPLICABLE)
})

test('Test 8: Rule 3 applicability returns not applicable for exempt consumer types', () => {
  const ruleResult = isRuleApplicable(RULE_3, { consumerType: 'INDUSTRIAL' })
  assert.equal(ruleResult.status, NOT_APPLICABLE)
})

test('Test 9: Missing applicability context returns REVIEW/UNKNOWN', () => {
  const scope = evaluateApplicability({})
  assert.equal(scope.status, REVIEW)
  assert.equal(scope.scope.chapterII, null)
  assert.ok(scope.missingContext.includes('consumerType'))

  const ruleResult = isRuleApplicable(RULE_3, {})
  assert.equal(ruleResult.status, REVIEW)
  assert.ok(ruleResult.missing.includes('consumerType'))
})

test('Test 11: Industrial consumer context is represented', () => {
  const scope = evaluateApplicability({ consumerType: 'INDUSTRIAL' })
  assert.equal(scope.status, NOT_APPLICABLE)
  assert.equal(scope.scope.chapterII, false)
  assert.equal(scope.context.consumerType, 'INDUSTRIAL')
})

test('Test 12: Institutional consumer context is represented', () => {
  const scope = evaluateApplicability({ consumerType: 'INSTITUTIONAL' })
  assert.equal(scope.status, NOT_APPLICABLE)
  assert.equal(scope.scope.chapterII, false)
  assert.equal(scope.context.consumerType, 'INSTITUTIONAL')
})

test('Test 10: Imported product context is represented', () => {
  const ruleResult = isRuleApplicable(RULE_6_10A_2026, {
    consumerType: 'RETAIL',
    importStatus: 'IMPORTED',
  })
  assert.equal(ruleResult.status, APPLICABLE)
  assert.equal(ruleResult.context.importStatus, 'IMPORTED')

  const domestic = isRuleApplicable(RULE_6_10A_2026, {
    consumerType: 'RETAIL',
    importStatus: 'DOMESTIC',
  })
  assert.equal(domestic.status, NOT_APPLICABLE)

  // Missing import status -> REVIEW, never assume.
  const unknown = isRuleApplicable(RULE_6_10A_2026, {})
  assert.equal(unknown.status, REVIEW)
  assert.ok(unknown.missing.includes('importStatus'))
})

test('Quantity outside the stated scope is distinguishable', () => {
  const scopedRule = {
    ruleId: 'TEST-SCOPED-QUANTITY',
    applicability: { quantityRange: { min: 100, max: 1000, unit: 'g' } },
  }
  const below = isRuleApplicable(scopedRule, {
    consumerType: 'RETAIL',
    packageQuantity: 50,
    packageUnit: 'g',
  })
  assert.equal(below.status, NOT_APPLICABLE)

  const above = isRuleApplicable(scopedRule, {
    consumerType: 'RETAIL',
    packageQuantity: 2000,
    packageUnit: 'g',
  })
  assert.equal(above.status, NOT_APPLICABLE)

  const inside = isRuleApplicable(scopedRule, {
    consumerType: 'RETAIL',
    packageQuantity: 500,
    packageUnit: 'g',
  })
  assert.equal(inside.status, APPLICABLE)

  const missingQuantity = isRuleApplicable(scopedRule, { consumerType: 'RETAIL', packageUnit: 'g' })
  assert.equal(missingQuantity.status, REVIEW)
  assert.ok(missingQuantity.missing.includes('packageQuantity'))
})

test('Domain-constrained rules respect product domain and REVIEW when absent', () => {
  const domainRule = {
    ruleId: 'TEST-DOMAIN-RULE',
    applicability: { domains: ['FOOD'] },
  }
  assert.equal(
    isRuleApplicable(domainRule, { consumerType: 'RETAIL', domain: 'FOOD' }).status,
    APPLICABLE,
  )
  assert.equal(
    isRuleApplicable(domainRule, { consumerType: 'RETAIL', domain: 'ELECTRONIC_PRODUCT' }).status,
    NOT_APPLICABLE,
  )
  const missing = isRuleApplicable(domainRule, { consumerType: 'RETAIL' })
  assert.equal(missing.status, REVIEW)
  assert.ok(missing.missing.includes('domain'))
})

test('evaluateApplicability consumes quantity/package/import/domain context', () => {
  const result = evaluateApplicability({
    consumerType: 'RETAIL',
    packageType: 'STANDARD',
    importStatus: 'IMPORTED',
    domain: 'FOOD',
    packageQuantity: 500,
    packageUnit: 'g',
    date: '2026-09-05',
  })
  assert.equal(result.status, APPLICABLE)
  assert.equal(result.context.consumerType, 'RETAIL')
  assert.equal(result.context.importStatus, 'IMPORTED')
  assert.equal(result.context.domain, 'FOOD')
  assert.equal(result.context.packageQuantity, 500)
  assert.equal(result.context.packageUnit, 'g')
  assert.equal(result.importStatus, 'IMPORTED')
})

test('Every foundational rule is resolvable through the applicability service', () => {
  for (const rule of FOUNDATIONAL_RULES) {
    const result = isRuleApplicable(rule, { consumerType: 'RETAIL' })
    assert.ok(
      [APPLICABLE, NOT_APPLICABLE, REVIEW].includes(result.status),
      `${rule.ruleId} -> ${result.status}`,
    )
  }
})

test('normalizeProductContext fills UNKNOWN defaults and never fabricates', () => {
  const ctx = normalizeProductContext({})
  assert.equal(ctx.consumerType, 'UNKNOWN')
  assert.equal(ctx.importStatus, 'UNKNOWN')
  assert.equal(ctx.packageType, 'UNKNOWN')
  assert.equal(ctx.packageQuantity, null)
})