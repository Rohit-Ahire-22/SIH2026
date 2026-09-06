import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RULES,
  getRuleById,
  getApplicableRules,
  getActiveRuleSnapshot,
  isRuleActiveOn,
} from '../../src/legal/rules/ruleRegistry.js'
import {
  FOUNDATIONAL_RULES,
  FOUNDATIONAL_RULE_COUNT,
  MANDATORY_DECLARATION_IDENTIFIERS,
} from '../../src/legal/rules/lmpcRules.js'
import {
  LMPC_AMENDMENTS,
  LMPC_AMENDMENT_COUNT,
  COUNTRY_OF_ORIGIN_2026_RULE,
  COUNTRY_OF_ORIGIN_2027_RULE,
} from '../../src/legal/rules/lmpcAmendments.js'

test('Test 1: Rule registry loads foundational rules and amendments', () => {
  assert.equal(FOUNDATIONAL_RULE_COUNT, 9)
  assert.equal(LMPC_AMENDMENT_COUNT, 2)
  assert.equal(RULES.length, FOUNDATIONAL_RULE_COUNT + LMPC_AMENDMENT_COUNT)
  assert.ok(RULES.length > 0)
})

test('Test 2: Every registered rule has a unique ruleId', () => {
  const ids = RULES.map((rule) => rule.ruleId)
  assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0))
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) {
    assert.equal(getRuleById(id).ruleId, id)
  }
  assert.equal(getRuleById('DOES-NOT-EXIST'), null)
})

test('Test 3: Every verified rule has official provenance', () => {
  for (const rule of RULES) {
    assert.ok(rule.verified, `${rule.ruleId} must be marked verified`)
    assert.equal(rule.sourceAuthority, 'Department of Consumer Affairs')
    assert.equal(rule.act, 'Legal Metrology Act, 2009')
    assert.equal(
      rule.rules,
      'Legal Metrology (Packaged Commodities) Rules, 2011',
    )
    assert.ok(
      typeof rule.sourceDocument === 'string' && rule.sourceDocument.length > 0,
      `${rule.ruleId} must carry a sourceDocument`,
    )
    assert.ok(
      typeof rule.sourceUrl === 'string' && rule.sourceUrl.length > 0,
      `${rule.ruleId} must carry a sourceUrl`,
    )
  }
})

test('Foundational rule set covers the required categories', () => {
  const byClause = new Map(FOUNDATIONAL_RULES.map((r) => [r.clause, r]))
  for (const expected of ['3', '4', '6', '7', '8', '9', '11', '12', 'First Schedule']) {
    assert.ok(byClause.has(expected), `missing rule clause ${expected}`)
  }
  assert.ok(MANDATORY_DECLARATION_IDENTIFIERS.includes('countryOfOrigin'))
  assert.ok(MANDATORY_DECLARATION_IDENTIFIERS.includes('commonGenericName'))
  assert.ok(MANDATORY_DECLARATION_IDENTIFIERS.includes('consumerCarePhone'))
  assert.ok(byClause.get('6').declarationIdentifiers.includes('mrp'))
})

test('Test 4: Future rules are excluded (2027 version not active in 2026)', () => {
  const ids = getApplicableRules({ asOfDate: '2026-09-05' }).map((r) => r.ruleId)
  assert.ok(!ids.includes(COUNTRY_OF_ORIGIN_2027_RULE.ruleId))
  assert.equal(isRuleActiveOn(COUNTRY_OF_ORIGIN_2027_RULE, '2026-09-05'), false)
})

test('Test 5: Current rules are included (2026 amendment + foundational 2011 rules)', () => {
  const snapshot = getApplicableRules({ asOfDate: '2026-09-05' })
  const ids = snapshot.map((r) => r.ruleId)
  assert.ok(ids.includes(COUNTRY_OF_ORIGIN_2026_RULE.ruleId))
  for (const base of FOUNDATIONAL_RULES) {
    assert.ok(ids.includes(base.ruleId), `${base.ruleId} should be active`)
  }
})

test('Test 6: Expired rules are excluded', () => {
  const after2026 = getApplicableRules({ asOfDate: '2027-07-02' })
  const ids = after2026.map((r) => r.ruleId)
  assert.ok(!ids.includes(COUNTRY_OF_ORIGIN_2026_RULE.ruleId))
  assert.ok(ids.includes(COUNTRY_OF_ORIGIN_2027_RULE.ruleId))
})

test('Test 7: No future rule can be silently selected', () => {
  // asOfDate before every exact effectiveFrom must exclude that rule.
  assert.equal(isRuleActiveOn(COUNTRY_OF_ORIGIN_2026_RULE, '2026-06-30'), false)
  assert.equal(isRuleActiveOn(COUNTRY_OF_ORIGIN_2027_RULE, '2027-06-30'), false)
  // The reference date from the step brief.
  for (const rule of getApplicableRules({ asOfDate: '2026-09-05' })) {
    if (rule.effectiveFrom) {
      assert.ok(rule.effectiveFrom <= '2026-09-05')
    }
  }
})

test('Test 13: 2026 country-of-origin rule is active after 2026-07-01 (inclusive)', () => {
  for (const day of ['2026-07-01', '2026-09-05', '2026-12-31', '2027-06-30']) {
    const ids = getApplicableRules({ asOfDate: day }).map((r) => r.ruleId)
    assert.ok(ids.includes(COUNTRY_OF_ORIGIN_2026_RULE.ruleId), day)
    assert.equal(isRuleActiveOn(COUNTRY_OF_ORIGIN_2026_RULE, day), true, day)
  }
})

test('Test 14: 2026 country-of-origin rule is not active before 2026-07-01', () => {
  for (const day of ['2026-01-01', '2026-06-30']) {
    const ids = getApplicableRules({ asOfDate: day }).map((r) => r.ruleId)
    assert.ok(!ids.includes(COUNTRY_OF_ORIGIN_2026_RULE.ruleId), day)
    assert.equal(isRuleActiveOn(COUNTRY_OF_ORIGIN_2026_RULE, day), false, day)
  }
})

test('Test 15: 2027 replacement does not activate before 2027-07-01', () => {
  for (const day of ['2026-09-05', '2027-06-30']) {
    const ids = getApplicableRules({ asOfDate: day }).map((r) => r.ruleId)
    assert.ok(!ids.includes(COUNTRY_OF_ORIGIN_2027_RULE.ruleId), day)
  }
  const ids = getApplicableRules({ asOfDate: '2027-07-01' }).map((r) => r.ruleId)
  assert.ok(ids.includes(COUNTRY_OF_ORIGIN_2027_RULE.ruleId))
  assert.ok(!ids.includes(COUNTRY_OF_ORIGIN_2026_RULE.ruleId))
})

test('Superseding versions are resolved deterministically (never both active)', () => {
  for (const day of ['2026-09-05', '2027-01-01', '2027-07-01', '2027-07-02']) {
    const clause6Rules = getApplicableRules({ asOfDate: day }).filter(
      (r) => r.clause === '6(10A)',
    )
    const ids = clause6Rules.map((r) => r.ruleId)
    assert.equal(ids.length, 1, `exactly one 6(10A) version on ${day}: ${ids}`)
  }
  assert.equal(COUNTRY_OF_ORIGIN_2027_RULE.supersedes.includes('LMPC-RULE6-10A-2026'), true)
  assert.equal(COUNTRY_OF_ORIGIN_2026_RULE.supersededBy, 'LMPC-RULE6-10A-2027')
})

test('getActiveRuleSnapshot returns stable date-versioned projection', () => {
  assert.deepEqual(
    getActiveRuleSnapshot('2026-09-05').find(
      (r) => r.ruleId === COUNTRY_OF_ORIGIN_2026_RULE.ruleId,
    ),
    {
      ruleId: 'LMPC-RULE6-10A-2026',
      ruleNumber: '6',
      clause: '6(10A)',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2027-06-30',
    },
  )
  assert.deepEqual(
    getActiveRuleSnapshot('2027-07-01').find(
      (r) => r.ruleId === COUNTRY_OF_ORIGIN_2027_RULE.ruleId,
    ),
    {
      ruleId: 'LMPC-RULE6-10A-2027',
      ruleNumber: '6',
      clause: '6(10A)',
      effectiveFrom: '2027-07-01',
      effectiveTo: null,
    },
  )
})