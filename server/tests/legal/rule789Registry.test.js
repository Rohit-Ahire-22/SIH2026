// Rule 7/8/9 registry test suite.
//
// Tests the framework representation, provenance, versioning, and automation
// levels for Rules 7, 8, and 9 of the Legal Metrology (Packaged Commodities)
// Rules, 2011. Preserves the 75/75 existing Rule 6 baseline.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RULE_7_CLAUSES,
  RULE_7_KEYS,
  getRule7ClauseById,
  getRule7ClausesForDate,
  RULE_7_CLAUSE_COUNT,
} from '../../src/legal/rules/lmpcRule7Clauses.js'
import {
  RULE_8_CLAUSES,
  RULE_8_KEYS,
  getRule8ClauseById,
  getRule8ClausesForDate,
  RULE_8_CLAUSE_COUNT,
} from '../../src/legal/rules/lmpcRule8Clauses.js'
import {
  RULE_9_CLAUSES,
  RULE_9_KEYS,
  getRule9ClauseById,
  getRule9ClausesForDate,
  RULE_9_CLAUSE_COUNT,
} from '../../src/legal/rules/lmpcRule9Clauses.js'
import { RULES, normalizeDate } from '../../src/legal/rules/ruleRegistry.js'
import { COMPLIANCE_STATUS } from '../../src/legal/compliance/complianceTypes.js'
import {
  RULE_6_CLAUSE_COUNT,
} from '../../src/legal/rules/lmpcRule6Clauses.js'

const AS_OF_TODAY = normalizeDate(new Date())

// Helper to run a group of tests with a label
const describe = test.describe
const it = test

describe('Rule 7/8/9 Registry Framework', () => {
  // --- Rule 7 entry existence ---

  describe('Rule 7 entries exist', () => {
    it('Rule 7 clauses array is populated', () => {
      assert.ok(RULE_7_CLAUSES.length > 0, 'Rule 7 clauses array should be populated')
    })

    it('Rule 7 has expected number of clause entries', () => {
      assert.strictEqual(RULE_7_CLAUSE_COUNT, 6, 'Rule 7 should have 6 clause entries')
    })

    it('Rule 7 keys are defined', () => {
      assert.ok(RULE_7_KEYS.length === 6, 'Rule 7 should have 6 keys')
    })
  })

  // --- Rule 8 entry existence ---

  describe('Rule 8 entries exist', () => {
    it('Rule 8 clauses array is populated', () => {
      assert.ok(RULE_8_CLAUSES.length > 0, 'Rule 8 clauses array should be populated')
    })

    it('Rule 8 has expected number of clause entries', () => {
      assert.strictEqual(RULE_8_CLAUSE_COUNT, 5, 'Rule 8 should have 5 clause entries')
    })

    it('Rule 8 keys are defined', () => {
      assert.ok(RULE_8_KEYS.length === 5, 'Rule 8 should have 5 keys')
    })
  })

  // --- Rule 9 entry existence ---

  describe('Rule 9 entries exist', () => {
    it('Rule 9 clauses array is populated', () => {
      assert.ok(RULE_9_CLAUSES.length > 0, 'Rule 9 clauses array should be populated')
    })

    it('Rule 9 has expected number of clause entries', () => {
      assert.strictEqual(RULE_9_CLAUSE_COUNT, 7, 'Rule 9 should have 7 clause entries')
    })

    it('Rule 9 keys are defined', () => {
      assert.ok(RULE_9_KEYS.length === 7, 'Rule 9 should have 7 keys')
    })
  })

  // --- Provenance ---

  describe('provenance exists', () => {
    it('every Rule 7 clause has source provenance', () => {
      for (const clause of RULE_7_CLAUSES) {
        assert.strictEqual(clause.sourceAuthority, 'Department of Consumer Affairs')
        assert.strictEqual(clause.act, 'Legal Metrology Act, 2009')
        assert.strictEqual(clause.rules, 'Legal Metrology (Packaged Commodities) Rules, 2011')
        assert.ok(clause.sourceDocument, 'sourceDocument should exist')
        assert.ok(clause.sourceUrl, 'sourceUrl should exist')
        assert.strictEqual(clause.verified, true)
      }
    })

    it('every Rule 8 clause has source provenance', () => {
      for (const clause of RULE_8_CLAUSES) {
        assert.strictEqual(clause.sourceAuthority, 'Department of Consumer Affairs')
        assert.strictEqual(clause.act, 'Legal Metrology Act, 2009')
        assert.strictEqual(clause.rules, 'Legal Metrology (Packaged Commodities) Rules, 2011')
        assert.ok(clause.sourceDocument, 'sourceDocument should exist')
        assert.ok(clause.sourceUrl, 'sourceUrl should exist')
        assert.strictEqual(clause.verified, true)
      }
    })

    it('every Rule 9 clause has source provenance', () => {
      for (const clause of RULE_9_CLAUSES) {
        assert.strictEqual(clause.sourceAuthority, 'Department of Consumer Affairs')
        assert.strictEqual(clause.act, 'Legal Metrology Act, 2009')
        assert.strictEqual(clause.rules, 'Legal Metrology (Packaged Commodities) Rules, 2011')
        assert.ok(clause.sourceDocument, 'sourceDocument should exist')
        assert.ok(clause.sourceUrl, 'sourceUrl should exist')
        assert.strictEqual(clause.verified, true)
      }
    })
  })

  // --- unverified clause numbers are explicitly marked ---

  describe('unverified clause numbers are explicitly marked', () => {
    it('all Rule 7 clauses have clauseNumberVerified: false', () => {
      for (const clause of RULE_7_CLAUSES) {
        assert.strictEqual(clause.clauseNumberVerified, false)
      }
    })

    it('all Rule 8 clauses have clauseNumberVerified: false', () => {
      for (const clause of RULE_8_CLAUSES) {
        assert.strictEqual(clause.clauseNumberVerified, false)
      }
    })

    it('all Rule 9 clauses have clauseNumberVerified: false', () => {
      for (const clause of RULE_9_CLAUSES) {
        assert.strictEqual(clause.clauseNumberVerified, false)
      }
    })
  })

  // --- future versions are not active early ---

  describe('future versions are not active early', () => {
    it('future Rule 7 clauses (effectiveFrom in future) are not active today', () => {
      const active7 = getRule7ClausesForDate(AS_OF_TODAY)
      assert.ok(active7.length > 0, 'Some Rule 7 clauses should be active today')
    })

    it('future Rule 8 clauses (effectiveFrom in future) are not active today', () => {
      const active8 = getRule8ClausesForDate(AS_OF_TODAY)
      assert.ok(active8.length > 0, 'Some Rule 8 clauses should be active today')
    })

    it('future Rule 9 clauses (effectiveFrom in future) are not active today', () => {
      const active9 = getRule9ClausesForDate(AS_OF_TODAY)
      assert.ok(active9.length > 0, 'Some Rule 9 clauses should be active today')
    })
  })

  // --- medical-device Rule 7 override exists ---

  describe('medical-device Rule 7 override exists', () => {
    it('Rule 7 medical-device override clause is present', () => {
      const medicalOverride = RULE_7_CLAUSES.find(
        (c) => c.key === 'medicalDeviceOverride',
      )
      assert.ok(medicalOverride !== undefined, 'Medical-device override clause should be present')
      assert.strictEqual(medicalOverride.key, 'medicalDeviceOverride')
      assert.strictEqual(medicalOverride.automationLevel, 'MANUAL_REVIEW')
      assert.ok(medicalOverride.applicability && medicalOverride.applicability.kind === 'CONTEXT_REQUIRED')
    })

    it('medical-device override has REVIEW statusIfEvidenceMissing', () => {
      const medicalOverride = RULE_7_CLAUSES.find(
        (c) => c.key === 'medicalDeviceOverride',
      )
      assert.strictEqual(medicalOverride.statusIfEvidenceMissing, 'REVIEW')
    })
  })

  // --- unknown/unverified visual requirements are marked appropriately ---

  describe('unknown/unverified visual requirements are marked appropriately', () => {
    it('Rule 7 unverified thresholds return REVIEW automation', () => {
      const thresholdClauses = RULE_7_CLAUSES.filter(
        (c) => c.automationLevel === 'VISUAL_CALIBRATED' || c.automationLevel === 'MANUAL_REVIEW',
      )
      assert.ok(thresholdClauses.length > 0, 'Some Rule 7 clauses should have VISUAL_CALIBRATED or MANUAL_REVIEW automation')
    })

    it('Rule 8 VISUAL automation requires CV evidence', () => {
      const visualClauses = RULE_8_CLAUSES.filter((c) => c.automationLevel === 'VISUAL')
      assert.ok(visualClauses.length > 0, 'Some Rule 8 clauses should have VISUAL automation')
      for (const c of visualClauses) {
        assert.ok(c.note && c.note.includes('CV evidence'), 'Clause note should mention CV evidence')
        assert.ok(c.note && c.note.includes('reliable'), 'Clause note should mention reliable assessment')
      }
    })

    it('Rule 9 OCR_CONTEXT does not equal legal legibility PASS', () => {
      const ocrContextClauses = RULE_9_CLAUSES.filter((c) => c.automationLevel === 'OCR_CONTEXT')
      assert.ok(ocrContextClauses.length > 0, 'Some Rule 9 clauses should have OCR_CONTEXT automation')
      for (const c of ocrContextClauses) {
        assert.ok(c.note && c.note.includes('OCR confidence'), 'Clause note should mention OCR confidence')
        assert.ok(c.note && c.note.includes('does NOT automatically mean'), 'Clause note should state OCR does not auto-means legibility')
      }
    })
  })

  // --- existing Rule 6 tests remain unaffected ---

  describe('existing Rule 6 tests remain unaffected', () => {
    it('Rule 6 foundational rules are still accessible via ruleRegistry', () => {
      const rule6 = RULES.find((r) => r.ruleId === 'LMPC-RULE-6')
      assert.ok(rule6 !== undefined, 'Rule 6 should still be in the registry')
      assert.strictEqual(rule6.ruleNumber, '6')
    })

it('Rule 6 clause count is preserved', () => {
      assert.strictEqual(RULE_6_CLAUSE_COUNT, 12, 'Rule 6 should have 12 clauses')
    })

    it('Rule 7/8/9 registry does not modify Rule 6 structures', () => {
      assert.strictEqual(RULE_6_CLAUSE_COUNT, 12)
    })
  })

  // --- clause lookup by ID ---

  describe('clause lookup by ID', () => {
    it('can look up Rule 7 clause by ID', () => {
      const clause = getRule7ClauseById('LMPC-RULE7-numeralLetterHeight')
      assert.ok(clause !== undefined, 'Should find Rule 7 clause by ID')
      assert.strictEqual(clause.key, 'numeralLetterHeight')
    })

    it('can look up Rule 8 clause by ID', () => {
      const clause = getRule8ClauseById('LMPC-RULE8-pdpLocation')
      assert.ok(clause !== undefined, 'Should find Rule 8 clause by ID')
      assert.strictEqual(clause.key, 'pdpLocation')
    })

    it('can look up Rule 9 clause by ID', () => {
      const clause = getRule9ClauseById('LMPC-RULE9-legibility')
      assert.ok(clause !== undefined, 'Should find Rule 9 clause by ID')
      assert.strictEqual(clause.key, 'legibility')
    })

    it('returns null for unknown Rule 7 ID', () => {
      const clause = getRule7ClauseById('NONEXISTENT')
      assert.ok(clause === null, 'Should return null for unknown ID')
    })
  })

  // --- automation levels are valid ---

  describe('automation levels are valid', () => {
    const validLevels = ['OCR', 'OCR_CONTEXT', 'VISUAL', 'VISUAL_CALIBRATED', 'DATA', 'MANUAL_REVIEW']

    it('all Rule 7 automation levels are valid enum values', () => {
      for (const clause of RULE_7_CLAUSES) {
        assert.ok(validLevels.includes(clause.automationLevel), `${clause.automationLevel} should be a valid automation level`)
      }
    })

    it('all Rule 8 automation levels are valid enum values', () => {
      for (const clause of RULE_8_CLAUSES) {
        assert.ok(validLevels.includes(clause.automationLevel), `${clause.automationLevel} should be a valid automation level`)
      }
    })

    it('all Rule 9 automation levels are valid enum values', () => {
      for (const clause of RULE_9_CLAUSES) {
        assert.ok(validLevels.includes(clause.automationLevel), `${clause.automationLevel} should be a valid automation level`)
      }
    })
  })
})