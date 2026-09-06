// Shared helpers for the Rules 7 / 8 / 9 clause-level registry modules.
// Reuses the existing compliance source provenance and the Rule 6 automation
// level enum (extended with VISUAL_CALIBRATED). No duplicate status/evidence
// systems are introduced here.

import { AUTOMATION_LEVELS } from './lmpcRule6Clauses.js'
import { isRuleActiveOn } from './ruleRegistry.js'

export { isRuleActiveOn }

export const OFFICIAL_SOURCE = Object.freeze({
  sourceAuthority: 'Department of Consumer Affairs',
  act: 'Legal Metrology Act, 2009',
  rules: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  sourceDocument:
    'Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)',
  sourceUrl: 'https://www.indiacode.nic.in/',
  verified: true,
})

function assertAutomation(level) {
  if (!AUTOMATION_LEVELS.includes(level)) {
    throw new Error(`Invalid automation level: ${level}`)
  }
  return level
}

// Base for Rule 7 / 8 / 9 clause entries.
// Effective dates default to null (no fabricated commencement). Exact
// sub-clause numbers are NOT asserted at this stage (clauseNumberVerified=false)
// unless the caller provides a verified numeric clause.
export function baseRuleClause({ ruleNumber, ...input }) {
  return Object.freeze({
    ruleNumber,
    checkType: 'VISUAL_EVIDENCE',
    effectiveFrom: null,
    effectiveTo: null,
    sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
    act: OFFICIAL_SOURCE.act,
    rules: OFFICIAL_SOURCE.rules,
    sourceDocument: OFFICIAL_SOURCE.sourceDocument,
    sourceUrl: OFFICIAL_SOURCE.sourceUrl,
    verified: true,
    clauseNumberVerified: false,
    statusIfEvidenceMissing: 'REVIEW',
    exceptions: { note: 'No verified exception encoded in this step.' },
    ...input,
    automationLevel: assertAutomation(input.automationLevel),
  })
}

export function filterClausesByDate(clauses, asOfDate) {
  return clauses.filter((clause) => isRuleActiveOn(clause, asOfDate))
}

export function buildClauseMap(clauses) {
  return new Map(clauses.map((clause) => [clause.ruleId, clause]))
}

export function getClauseById(clauseMap, ruleId) {
  return clauseMap.get(ruleId) || null
}