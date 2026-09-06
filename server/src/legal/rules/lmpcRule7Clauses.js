// Clause-level Rule 7 representation.
//
// Rule 7 of the Legal Metrology (Packaged Commodities) Rules, 2011 prescribes
// minimum height requirements for numerals and letters used in mandatory
// declarations, and additional typography requirements that depend on package
// size, commodity type, and context. This module represents individual Rule 7
// requirements independently so the compliance engine can evaluate each one.
//
// SCOPE / VERIFICATION NOTES:
// - These entries assert the EXISTENCE of well-established Rule 7 requirement
//   categories (minimum numeral/letter height, PDP treatment, small-package
//   exemptions, medical-device overrides) as verified against the official Rules
//   2011 material documented in this project.
// - No exact Rule 7 sub-clause NUMBER is asserted (clauseNumberVerified=false):
//   renumbering/merging across amendments is a legal fact that must be
//   reconciled from the official Gazette text before any numeric clause is
//   claimed. Never guess a clause number.
// - Numerical thresholds are deliberately NOT encoded. Any check that requires
//   a physical millimetre measurement from an uncalibrated image will return
//   REVIEW. Only future calibrated (VISUAL_CALIBRATED) evidence can support
//   definitive PASS/FAIL on size thresholds.
// - Clause entries carry effectiveFrom/effectiveTo and are date-filtered with
//   the same inclusive semantics as the main registry (isRuleActiveOn).
// - Medical Devices Rules, 2017 override (per the 2025 amendment) is represented
//   as a separate applicability path. If the exact typography values from that
//   amendment have not been incorporated into this project, the framework
//   exposes the requirement and returns REVIEW for any conclusion depending on
//   those unverified details.
//
// These entries are not a complete or authoritative statement of law.

import { isRuleActiveOn } from './ruleRegistry.js'

export const AUTOMATION_LEVELS = Object.freeze([
  'OCR', // reasonable to evaluate from OCR / extracted text
  'OCR_CONTEXT', // OCR plus product/package context
  'VISUAL', // requires image/CV evidence
  'VISUAL_CALIBRATED', // requires physical scale/calibration for a reliable measurement
  'DATA', // requires trusted external/product metadata
  'MANUAL_REVIEW', // cannot be judged automatically from current evidence
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
    ruleNumber: '7',
    checkType: 'PHOTO_ASSESSABLE',
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

// --- Rule 7 entries ---

export const RULE_7_CLAUSES = Object.freeze(
  [
    baseClause({
      ruleId: 'LMPC-RULE7-numeralLetterHeight',
      key: 'numeralLetterHeight',
      clause: '7 (minimum height of numerals and letters)',
      title: 'Minimum height of numerals and letters',
      requirement:
        'Prescribes minimum heights for numerals and letters used in mandatory declarations on retail packages. Exact numerical thresholds depend on the currently applicable official rule version.',
      evidenceFields: ['ocrResults', 'commonGenericName', 'netQuantity'],
      automationLevel: 'VISUAL_CALIBRATED',
      applicability: {},
      note:
        'Minimum height thresholds are not hard-coded here. Without calibrated physical measurement, this check returns REVIEW. Pixel height from OCR bounding boxes does not equal millimetres.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE7-smallPackage',
      key: 'smallPackage',
      clause: '7 (small-package treatment)',
      title: 'Small-package treatment',
      requirement:
        'Provides for reduced or modified declaration requirements when the package falls below a defined size threshold. Exact size threshold for small-package exemption must be verified against the current official rule version.',
      evidenceFields: ['ocrResults', 'commonGenericName'],
      automationLevel: 'MANUAL_REVIEW',
      applicability: { kind: 'CONTEXT_REQUIRED', contextFields: ['packageDimensions'] },
      note:
        'Small-package exemption threshold is not encoded. If package size context is unknown or unverified, the check returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE7-letterHeight',
      key: 'letterHeight',
      clause: '7 (letter height)',
      title: 'Letter height requirement',
      requirement:
        'Prescribes minimum letter height for declarations on the principal display panel. Exact numerical value depends on the currently applicable official rule version.',
      evidenceFields: ['ocrResults'],
      automationLevel: 'VISUAL_CALIBRATED',
      applicability: {},
      note:
        'Letter height cannot be verified from OCR bounding boxes alone without physical scale calibration. Without calibration, returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE7-letterWidthRatio',
      key: 'letterWidthRatio',
      clause: '7 (letter/numeral width relationship)',
      title: 'Letter/numeral width relationship',
      requirement:
        'Prescribes the proportional relationship between letter width and height (aspect ratio) for declarations on packaged commodities. Exact ratio depends on the currently applicable official rule version.',
      evidenceFields: ['ocrResults'],
      automationLevel: 'VISUAL_CALIBRATED',
      applicability: {},
      note:
        'Width-to-height ratio cannot be verified from OCR bounding boxes without calibrated measurement. Without calibration, returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE7-quantityTypeDependentSize',
      key: 'quantityTypeDependentSize',
      clause: '7 (quantity-type-dependent numeral size)',
      title: 'Quantity-type-dependent numeral size',
      requirement:
        'Prescribes numeral size requirements that vary according to the type of quantity declaration (e.g., net weight vs. volume vs. count). The quantity-type-dependent thresholds are not hard-coded here.',
      evidenceFields: ['ocrResults', 'netQuantity'],
      automationLevel: 'VISUAL_CALIBRATED',
      applicability: {},
      note:
        'Quantity-type-dependent size thresholds are not encoded. Without verified official thresholds, returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE7-medicalDeviceOverride',
      key: 'medicalDeviceOverride',
      clause: '7 (medical-device typography override)',
      title: 'Medical-device typography override',
      requirement:
        'For medical-device packages, the ordinary Rule 7 typography thresholds do NOT apply blindly. The Medical Devices Rules, 2017 (per the 2025 official amendment) provides a separate applicability path for typography requirements.',
      evidenceFields: ['ocrResults', 'domain'],
      automationLevel: 'MANUAL_REVIEW',
      applicability: { kind: 'CONTEXT_REQUIRED', contextFields: ['domain'], requiredDomain: 'medical_device' },
      note:
        'Medical-device override: if context.domain is "medical_device", the ordinary Rule 7 size thresholds are suspended. The exact Medical Devices Rules typography values from the 2025 amendment have NOT been incorporated into this project. If the domain is medical_device and no verified override values exist, return REVIEW. If the domain is not medical_device, ordinary Rule 7 requirements apply.',
    }),
  ].map(Object.freeze),
)

export const RULE_7_CLAUSE_COUNT = RULE_7_CLAUSES.length
export const RULE_7_KEYS = Object.freeze(RULE_7_CLAUSES.map((clause) => clause.key))

const CLAUSE_MAP7 = new Map(RULE_7_CLAUSES.map((clause) => [clause.ruleId, clause]))

export function getRule7ClauseById(ruleId) {
  return CLAUSE_MAP7.get(ruleId) || null
}

export function getRule7Clauses() {
  return RULE_7_CLAUSES
}

// Date-versioned clause selection reusing the registry's inclusive
// effective-period semantics. Future clause versions are never selected.
export function getRule7ClausesForDate(asOfDate) {
  return RULE_7_CLAUSES.filter((clause) => isRuleActiveOn(clause, asOfDate))
}

export function filterRule7ClausesByDate(clauses, asOfDate) {
  return clauses.filter((clause) => isRuleActiveOn(clause, asOfDate))
}