// Clause-level Rule 11 and First Schedule representation.
//
// Rule 11 of the Legal Metrology (Packaged Commodities) Rules, 2011 lists
// the principles for declaring net quantity and ensuring actual physical
// quantity conforms to the Maximum Permissible Error (MPE) in the First Schedule.
//
// SCOPE / VERIFICATION NOTES:
// - These entries assert the EXISTENCE of well-established Rule 11 categories
//   (net quantity expression, MPE requirement).
// - No exact numeric clause numbers are verified.
// - The First Schedule exact tolerances (MPE numerical tables) are intentionally
//   left unverified (verified: false, MANUAL_REVIEW) because the exact
//   authoritative table values are not currently extracted/verifiable from
//   the project's sources.
// - These entries are not a complete or authoritative statement of law.

import { isRuleActiveOn } from './ruleRegistry.js'

export const AUTOMATION_LEVELS = Object.freeze([
  'OCR',
  'OCR_CONTEXT',
  'VISUAL',
  'VISUAL_CALIBRATED',
  'DATA',
  'MANUAL_REVIEW',
])

function assertAutomation(level) {
  if (!AUTOMATION_LEVELS.includes(level)) {
    throw new Error(`Invalid automation level: ${level}`)
  }
  return level
}

const OFFICIAL_SOURCE = Object.freeze({
  sourceAuthority: 'Department of Consumer Affairs',
  act: 'Legal Metrology Act, 2009',
  rules: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  sourceDocument:
    'Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)',
  sourceUrl: 'https://www.indiacode.nic.in/',
  verified: true,
})

function baseClause(input) {
  return Object.freeze({
    ruleNumber: '11',
    checkType: 'MEASUREMENT_DEPENDENT',
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

export const RULE_11_CLAUSES = Object.freeze(
  [
    baseClause({
      ruleId: 'LMPC-RULE11-netQuantityExpression',
      key: 'netQuantityExpression',
      clause: '11 (expression of net quantity)',
      title: 'Expression of net quantity',
      requirement:
        'Requires net quantity to be expressed in standard units of weight, measure, or number. Units must be recognized standard legal units.',
      evidenceFields: ['netQuantity', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Normalizes and validates the string declaration of net quantity.',
    }),
    baseClause({
      ruleId: 'LMPC-SCHEDULE1-mpe',
      key: 'maximumPermissibleError',
      ruleNumber: 'First Schedule',
      clause: 'First Schedule (Maximum Permissible Error)',
      title: 'Maximum Permissible Error (MPE)',
      requirement:
        'Requires the actual physical net quantity contained in the package to not fall below the declared quantity by more than the maximum permissible error prescribed in the First Schedule.',
      evidenceFields: ['netQuantity', 'observedQuantity'],
      automationLevel: 'MANUAL_REVIEW',
      applicability: {},
      verified: false,
      note:
        'TODO: Exact numerical MPE tables (First Schedule) cannot be verified from available official sources. Value thresholds remain unverified and trigger MANUAL_REVIEW. Furthermore, actual physical quantity measurement cannot be reliably extracted from a photograph; absence of physical measurement evidence strictly returns REVIEW.',
    }),
  ].map(Object.freeze),
)

export const RULE_11_CLAUSE_COUNT = RULE_11_CLAUSES.length
export const RULE_11_KEYS = Object.freeze(RULE_11_CLAUSES.map((clause) => clause.key))

const CLAUSE_MAP = new Map(RULE_11_CLAUSES.map((clause) => [clause.ruleId, clause]))

export function getRule11ClauseById(ruleId) {
  return CLAUSE_MAP.get(ruleId) || null
}

export function getRule11Clauses() {
  return RULE_11_CLAUSES
}

export function getRule11ClausesForDate(asOfDate) {
  return RULE_11_CLAUSES.filter((clause) => isRuleActiveOn(clause, asOfDate))
}

export function filterRule11ClausesByDate(clauses, asOfDate) {
  return clauses.filter((clause) => isRuleActiveOn(clause, asOfDate))
}
