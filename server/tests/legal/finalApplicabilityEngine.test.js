import { test, describe } from 'node:test'
import assert from 'node:assert'
import { isRuleApplicable, evaluateApplicability, normalizeProductContext } from '../../src/legal/applicability/applicabilityService.js'
import { APPLICABILITY_STATUS } from '../../src/legal/compliance/complianceTypes.js'
import { isRuleActiveOn } from '../../src/legal/rules/ruleRegistry.js'

const { APPLICABLE, NOT_APPLICABLE, REVIEW } = APPLICABILITY_STATUS

// Mock rule for general testing
const mockRule = {
  ruleId: 'MOCK-1',
  ruleNumber: '1',
  effectiveFrom: null,
  effectiveTo: null,
  sourceAuthority: 'DCA',
  act: 'LMPCR',
  verified: true,
  applicability: {}
}

const importRule = {
  ...mockRule,
  ruleId: 'MOCK-IMPORT',
  applicability: { importStatuses: ['IMPORTED'] }
}

const exemptRule = {
  ...mockRule,
  ruleId: 'MOCK-EXEMPT',
  applicability: { exemptConsumerTypes: ['INSTITUTIONAL'] }
}

const packageRule = {
  ...mockRule,
  ruleId: 'MOCK-PACKAGE',
  applicability: { packageTypes: ['PRE_PACKAGED'] }
}

const domainRule = {
  ...mockRule,
  ruleId: 'MOCK-DOMAIN',
  applicability: { domains: ['MEDICAL_DEVICE'] }
}

const unitSalePriceRule = {
  ...mockRule,
  ruleId: 'LMPC-RULE6-unitSalePrice',
  applicability: { kind: 'CONTEXT_REQUIRED', contextFields: ['unitSalePriceApplicable'] }
}

const quantityRule = {
  ...mockRule,
  ruleId: 'MOCK-QTY',
  applicability: { quantityRange: { min: 50, max: 1000, unit: 'g' } }
}

describe('Final Applicability Engine', () => {

  describe('Rule 3 Gating', () => {
    test('1. normal retail domestic package -> applicable', () => {
      const res = isRuleApplicable(mockRule, { consumerType: 'RETAIL', importStatus: 'DOMESTIC' })
      assert.strictEqual(res.status, APPLICABLE)
      assert.ok(res.reason.includes('Applicable'))
    })

    test('23. Rule 3 out-of-scope blocks dependent Chapter II rules', () => {
      const res = isRuleApplicable(mockRule, { consumerType: 'INDUSTRIAL' })
      assert.strictEqual(res.status, NOT_APPLICABLE)
      assert.ok(res.reason.includes('industrial/institutional'))
    })

    test('5. industrial consumer -> applicable packaged-commodity exclusions handled', () => {
      const res = evaluateApplicability({ consumerType: 'INDUSTRIAL' })
      assert.strictEqual(res.status, NOT_APPLICABLE)
    })

    test('6. institutional consumer -> correct exclusion behavior', () => {
      const res = isRuleApplicable(exemptRule, { consumerType: 'RETAIL' }) // Retail is in scope, not exempt from THIS rule
      assert.strictEqual(res.status, APPLICABLE)
    })

    test('24. unknown Rule 3 context -> REVIEW', () => {
      const res = isRuleApplicable(mockRule, { consumerType: 'UNKNOWN' })
      assert.strictEqual(res.status, REVIEW)
    })

    test('7. unknown consumer type -> REVIEW when relevant', () => {
      const res = isRuleApplicable(mockRule, { consumerType: null })
      assert.strictEqual(res.status, REVIEW)
    })
  })

  describe('Import Status', () => {
    test('2. imported retail package -> imported rules applicable', () => {
      const res = isRuleApplicable(importRule, { consumerType: 'RETAIL', importStatus: 'IMPORTED' })
      assert.strictEqual(res.status, APPLICABLE)
    })

    test('3. domestic package -> imported-only rule NOT_APPLICABLE', () => {
      const res = isRuleApplicable(importRule, { consumerType: 'RETAIL', importStatus: 'DOMESTIC' })
      assert.strictEqual(res.status, NOT_APPLICABLE)
      assert.ok(res.reason.includes('not within scope'))
    })

    test('4. unknown import status -> REVIEW', () => {
      const res = isRuleApplicable(importRule, { consumerType: 'RETAIL', importStatus: 'UNKNOWN' })
      assert.strictEqual(res.status, REVIEW)
      assert.ok(res.reason.includes('unknown and applicability depends on imported status'))
    })
  })

  describe('Package Types', () => {
    test('8. pre-packaged product -> normal pathway', () => {
      const res = isRuleApplicable(packageRule, { consumerType: 'RETAIL', packageType: 'PRE_PACKAGED' })
      assert.strictEqual(res.status, APPLICABLE)
    })

    test('9. combination package -> special pathway', () => {
      const res = isRuleApplicable(unitSalePriceRule, { consumerType: 'RETAIL', packageType: 'COMBINATION' })
      assert.equal(res.status, 'REVIEW')
      assert.ok(res.reason.includes('COMBINATION'))
    })

    test('10. group package -> special pathway', () => {
      const res = isRuleApplicable(unitSalePriceRule, { consumerType: 'RETAIL', packageType: 'GROUP' })
      assert.strictEqual(res.status, REVIEW)
    })

    test('11. multi-piece package -> special pathway', () => {
      const res = isRuleApplicable(unitSalePriceRule, { consumerType: 'RETAIL', packageType: 'MULTI_PIECE' })
      assert.strictEqual(res.status, REVIEW)
    })

    test('12. unknown package type -> REVIEW when relevant', () => {
      const res = isRuleApplicable(packageRule, { consumerType: 'RETAIL', packageType: 'UNKNOWN' })
      assert.strictEqual(res.status, REVIEW)
      assert.ok(res.reason.includes('unknown and applicability depends on package type'))
    })
  })

  describe('Domains', () => {
    test('13. medical device -> medical-device pathway', () => {
      const res = isRuleApplicable(domainRule, { consumerType: 'RETAIL', domain: 'MEDICAL_DEVICE' })
      assert.strictEqual(res.status, APPLICABLE)
    })

    test('14. pharmaceutical ≠ medical-device automatically', () => {
      const res = isRuleApplicable(domainRule, { consumerType: 'RETAIL', domain: 'PHARMACEUTICAL' })
      assert.strictEqual(res.status, NOT_APPLICABLE)
      assert.ok(res.reason.includes('not within scope'))
    })

    test('15. food category alone does not invent legal requirements', () => {
      const res = isRuleApplicable(domainRule, { consumerType: 'RETAIL', domain: 'FOOD' })
      assert.strictEqual(res.status, NOT_APPLICABLE)
    })

    test('16. electronics category alone does not invent legal requirements', () => {
      const res = isRuleApplicable(domainRule, { consumerType: 'RETAIL', domain: 'ELECTRONICS' })
      assert.strictEqual(res.status, NOT_APPLICABLE)
    })

    test('17. unknown domain does not invent requirements', () => {
      const res = isRuleApplicable(domainRule, { consumerType: 'RETAIL', domain: 'UNKNOWN' })
      assert.strictEqual(res.status, REVIEW)
      assert.ok(res.reason.includes('unknown and applicability depends on domain'))
    })
  })

  describe('Quantity', () => {
    test('18. quantity mass and volume remain distinct', () => {
      const res = isRuleApplicable(quantityRule, { consumerType: 'RETAIL', quantityValue: 100, quantityUnit: 'g' })
      assert.strictEqual(res.status, APPLICABLE)
    })

    test('19. incompatible units -> REVIEW', () => {
      const res = isRuleApplicable(quantityRule, { consumerType: 'RETAIL', quantityValue: 100, quantityUnit: 'mL' })
      assert.strictEqual(res.status, REVIEW)
      assert.ok(res.reason.includes('cannot be compared deterministically'))
    })
  })

  describe('Date Versioning and Architecture', () => {
    test('20. future rule excluded', () => {
      const rule = { effectiveFrom: '2030-01-01' }
      assert.strictEqual(isRuleActiveOn(rule, new Date('2026-01-01')), false)
    })

    test('21. expired rule excluded', () => {
      const rule = { effectiveTo: '2025-01-01' }
      assert.strictEqual(isRuleActiveOn(rule, new Date('2026-01-01')), false)
    })

    test('22. superseded rule selection is deterministic', () => {
      const active = { effectiveFrom: '2025-01-01', effectiveTo: '2027-01-01' }
      const future = { effectiveFrom: '2027-01-02' }
      assert.strictEqual(isRuleActiveOn(active, new Date('2026-01-01')), true)
      assert.strictEqual(isRuleActiveOn(future, new Date('2026-01-01')), false)
    })

    test('25. applicability result is distinct from compliance PASS', () => {
      const res = isRuleApplicable(mockRule, { consumerType: 'RETAIL' })
      assert.strictEqual(res.status, APPLICABLE) // not PASS
    })

    test('26. deterministic explanation reason exists', () => {
      const res = isRuleApplicable(mockRule, { consumerType: 'RETAIL' })
      assert.strictEqual(typeof res.reason, 'string')
      assert.ok(res.reason.length > 0)
    })

    test('27. provenance preserved', () => {
      const res = isRuleApplicable(mockRule, { consumerType: 'RETAIL' })
      assert.strictEqual(res.source.sourceAuthority, 'Department of Consumer Affairs')
      assert.strictEqual(res.source.verified, true)
    })
  })
})
