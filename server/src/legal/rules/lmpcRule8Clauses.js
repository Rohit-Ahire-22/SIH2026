// Clause-level Rule 8 representation.
//
// Rule 8 of the Legal Metrology (Packaged Commodities) Rules, 2011 prescribes
// the presentation, location, and placement requirements for mandatory
// declarations, particularly the requirement that declarations appear on the
// principal display panel (PDP) and specifies surrounding-space requirements.
//
// SCOPE / VERIFICATION NOTES:
// - These entries assert the EXISTENCE of well-established Rule 8 requirement
//   categories (PDP location, declaration placement, surrounding-space) as
//   verified against the official Rules 2011 material documented in this project.
// - No exact Rule 8 sub-clause NUMBER is asserted (clauseNumberVerified=false):
//   renumbering/merging across amendments is a legal fact that must be
//   reconciled from the official Gazette text before any numeric clause is
//   claimed. Never guess a clause number.
// - The framework uses stable internal identifiers for requirements that are
//   not yet fully clause-number-verified.
// - Physical panel detection or perspective assessment cannot be reliably
//   determined from OCR/image evidence alone. Without reliable CV evidence
//   identifying the principal display panel, the framework returns REVIEW for
//   legal location conclusions.
// - Clause entries carry effectiveFrom/effectiveTo and are date-filtered with
//   the same inclusive semantics as the main registry (isRuleActiveOn).
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
    ruleNumber: '8',
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

// --- Rule 8 entries ---

export const RULE_8_CLAUSES = Object.freeze(
  [
    baseClause({
      ruleId: 'LMPC-RULE8-pdpLocation',
      key: 'pdpLocation',
      clause: '8 (principal display panel location)',
      title: 'Principal display panel location',
      requirement:
        'Requires mandatory declarations to appear on the principal display panel (PDP) of the retail package. The PDP is the area most likely to be seen by the consumer under normal display conditions.',
      evidenceFields: ['ocrResults', 'images'],
      automationLevel: 'VISUAL',
      applicability: {},
      note:
        'The system cannot reliably identify the principal display panel from OCR or image evidence alone without dedicated CV panel detection. Without reliable CV evidence identifying the PDP, this check returns REVIEW for legal location conclusions. Do not implement a fake panel detector.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE8-declarationPlacement',
      key: 'declarationPlacement',
      clause: '8 (declaration placement)',
      title: 'Declaration placement on PDP',
      requirement:
        'Specifies that mandatory declarations must be placed on the principal display panel and must not be obscured, blocked, or rendered unreadable by other packaging elements, graphics, or labeling.',
      evidenceFields: ['ocrResults', 'images'],
      automationLevel: 'VISUAL',
      applicability: {},
      note:
        'Placement assessment is most reliable when the full panel is visible in the image. OCR text detection alone does not establish legal placement on the PDP. Without reliable CV evidence, returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE8-surroundingSpace',
      key: 'surroundingSpace',
      clause: '8 (quantity declaration display area and surrounding-space)',
      title: 'Quantity declaration display area and surrounding-space',
      requirement:
        'Prescribes surrounding-space requirements around the quantity declaration on the principal display panel to ensure readability. The exact space ratios and clearance dimensions are not hard-coded here.',
      evidenceFields: ['ocrResults', 'netQuantity'],
      automationLevel: 'VISUAL_CALIBRATED',
      applicability: {},
      note:
        'Surrounding-space requirements involve physical dimension measurements (clearance, margins) that cannot be reliably determined from OCR bounding boxes without calibrated image analysis. Without calibration, returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE8-presentedDeclarations',
      key: 'presentedDeclarations',
      clause: '8 (declarations being prominent and legible)',
      title: 'Declarations being prominent and legible',
      requirement:
        'Requires that mandatory declarations are presented prominently on the package and are legible to the ordinary consumer. Presentation includes size, contrast, and placement factors.',
      evidenceFields: ['ocrResults'],
      automationLevel: 'OCR_CONTEXT',
      applicability: {},
      note:
        'OCR text detection combined with product context may establish that text is present (PRESENT). However, OCR confidence does NOT automatically prove legal legibility or prominence. Without visual legibility verification, returns REVIEW.',
    }),
baseClause({
      ruleId: 'LMPC-RULE8-wrapperVisibility',
      key: 'wrapperVisibility',
      clause: '8 (package/wrapper declaration visibility)',
      title: 'Package/wrapper declaration visibility',
      requirement:
        'Prescribes that declarations must be visible through or outside the packaging/wrapper material. Transparent or semi-transparent wrappers must not obscure mandatory declaration text.',
      evidenceFields: ['ocrResults', 'images'],
      automationLevel: 'VISUAL',
      applicability: {},
      note:
        'Visual assessment of wrapper transparency and declaration visibility requires image evidence beyond OCR. Without reliable CV evidence, returns REVIEW.'
    }),
  ].map(Object.freeze),
)

export const RULE_8_CLAUSE_COUNT = RULE_8_CLAUSES.length
export const RULE_8_KEYS = Object.freeze(RULE_8_CLAUSES.map((clause) => clause.key))

const CLAUSE_MAP8 = new Map(RULE_8_CLAUSES.map((clause) => [clause.ruleId, clause]))

export function getRule8ClauseById(ruleId) {
  return CLAUSE_MAP8.get(ruleId) || null
}

export function getRule8Clauses() {
  return RULE_8_CLAUSES
}

// Date-versioned clause selection reusing the registry's inclusive
// effective-period semantics. Future clause versions are never selected.
export function getRule8ClausesForDate(asOfDate) {
  return RULE_8_CLAUSES.filter((clause) => isRuleActiveOn(clause, asOfDate))
}

export function filterRule8ClausesByDate(clauses, asOfDate) {
  return clauses.filter((clause) => isRuleActiveOn(clause, asOfDate))
}