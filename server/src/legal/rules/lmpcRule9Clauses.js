// Clause-level Rule 9 representation.
//
// Rule 9 of the Legal Metrology (Packaged Commodities) Rules, 2011 prescribes
// the manner of declarations — legibility, readability, contrast, and the
// prohibition on presentation methods that prevent normal reading of mandatory
// information. This module represents individual Rule 9 requirements independently
// so the compliance engine can evaluate each one.
//
// SCOPE / VERIFICATION NOTES:
// - These entries assert the EXISTENCE of well-established Rule 9 requirement
//   categories (legibility, prominence, contrasting presentation, language
//   framework) as verified against the official Rules 2011 material documented
//   in this project.
// - No exact Rule 9 sub-clause NUMBER is asserted (clauseNumberVerified=false):
//   renumbering/merging across amendments is a legal fact that must be
//   reconciled from the official Gazette text before any numeric clause is
//   claimed. Never guess a clause number.
// - OCR confidence does NOT equal legal legibility. The framework explicitly
//   reserves Rule 9 visual legibility PASS/FAIL for future CV evidence.
// - Do not treat OCR non-detection as confirmed absence. OCR failure -> REVIEW,
//   not FAIL, unless confirmed absent by inspected visual evidence.
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
    ruleNumber: '9',
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

// --- Rule 9 entries ---

export const RULE_9_CLAUSES = Object.freeze(
  [
    baseClause({
      ruleId: 'LMPC-RULE9-legibility',
      key: 'legibility',
      clause: '9 (legibility)',
      title: 'Legibility of declarations',
      requirement:
        'Prescribes that mandatory declarations must be legible. Legibility means the text must be sufficiently clear and readable for the ordinary consumer to comprehend the declared information.',
      evidenceFields: ['ocrResults'],
      automationLevel: 'OCR_CONTEXT',
      applicability: {},
      note:
        'OCR text detection (PRESENT) establishes that text is present. However, OCR confidence score does NOT automatically mean Rule 9 PASS. Visual legibility cannot be determined from OCR alone. Without CV evidence, returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE9-prominence',
      key: 'prominence',
      clause: '9 (prominence)',
      title: 'Prominence of declarations',
      requirement:
        'Prescribes that mandatory declarations must be presented prominently on the package. Prominence means the declarations must be readily noticeable and not obscured, hidden, or made inconspicuous by other packaging elements, graphics, or labeling.',
      evidenceFields: ['ocrResults', 'images'],
      automationLevel: 'VISUAL',
      applicability: {},
      note:
        'OCR text detection alone does not establish prominence. Visual prominence assessment requires image/CV evidence beyond text extraction. Without reliable visual evidence, returns REVIEW.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE9-contrastingPresentation',
      key: 'contrastingPresentation',
      clause: '9 (contrasting presentation)',
      title: 'Contrasting presentation',
      requirement:
        'Prescribes that declarations must have sufficient contrast against the background to be readable. Insufficient contrast (e.g., light text on light background, low-contrast printing) does not satisfy the requirement.',
      evidenceFields: ['ocrResults', 'images'],
      automationLevel: 'VISUAL',
      applicability: {},
      note:
        'Contrast assessment requires visual analysis of the image beyond OCR text extraction. Without reliable visual contrast evidence, returns REVIEW.',
    }),
baseClause({
      ruleId: 'LMPC-RULE9-languageFramework',
      key: 'languageFramework',
      clause: '9 (language framework)',
      title: 'Language framework for declarations',
      requirement:
        'Prescribes the language framework within which mandatory declarations must be made. The language used must be understandable to the ordinary consumer in the market where the package is sold. Language requirements may vary by commodity type and market.',
      evidenceFields: ['ocrResults', 'commonGenericName', 'domain'],
      automationLevel: 'OCR_CONTEXT',
      applicability: { kind: 'CONTEXT_REQUIRED', contextFields: ['domain', 'commodityType'] },
      note:
        'Language framework applicability depends on the commodity type and market domain. OCR confidence does NOT automatically mean language compliance. If domain/context is unknown, returns REVIEW. Do not assume language compliance from OCR alone.'
    }),
    baseClause({
      ruleId: 'LMPC-RULE9-readabilityThroughWrapper',
      key: 'readabilityThroughWrapper',
      clause: '9 (visibility/readability through or outside packaging)',
      title: 'Readability through or outside packaging/wrapper',
      requirement:
        'Prescribes that mandatory declarations must be readable through or outside the packaging/wrapper material. Transparent, translucent, or opaque wrappers must not prevent normal reading of declared information.',
      evidenceFields: ['ocrResults', 'images'],
      automationLevel: 'VISUAL',
      applicability: {},
      note:
        'Visual assessment of wrapper transparency and readability requires image evidence beyond OCR. Without reliable visual evidence, returns REVIEW. OCR detection of text beneath or outside a wrapper does not by itself prove compliance.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE9-prohibitionPreventNormalReading',
      key: 'prohibitionPreventNormalReading',
      clause: '9 (prohibition on presentation methods that prevent normal reading)',
      title: 'Prohibition on presentation methods that prevent normal reading',
      requirement:
        'Prohibits presentation methods that prevent normal reading of mandatory declarations. This includes obscured, blocked, faded, damaged, or otherwise rendered unreadable declarations, regardless of whether some text is technically detectable by OCR.',
      evidenceFields: ['ocrResults', 'images'],
      automationLevel: 'VISUAL',
      applicability: {},
      note:
        'The prohibition applies even if OCR can partially detect text. If presentation prevents normal reading, the requirement is not met. Without reliable visual evidence establishing reading normality, returns REVIEW.',
    }),
baseClause({
      ruleId: 'LMPC-RULE9-priceQuantityPresentation',
      key: 'priceQuantityPresentation',
      clause: '9 (required price/quantity presentation)',
      title: 'Required price/quantity presentation',
      requirement:
        'Prescribes that the price and quantity declarations must be present and presented according to the mandatory format requirements. Both the MRP (price) and net quantity must be clearly visible and readable on the package.',
      evidenceFields: ['ocrResults', 'mrp', 'netQuantity'],
      automationLevel: 'OCR_CONTEXT',
      applicability: {},
      note:
        'OCR detection of price and quantity values establishes PRESENT status. However, OCR confidence does NOT automatically mean legal compliance with format requirements. Visual verification of proper format and placement returns REVIEW without calibrated evidence.'
    }),
  ].map(Object.freeze),
)

export const RULE_9_CLAUSE_COUNT = RULE_9_CLAUSES.length
export const RULE_9_KEYS = Object.freeze(RULE_9_CLAUSES.map((clause) => clause.key))

const CLAUSE_MAP9 = new Map(RULE_9_CLAUSES.map((clause) => [clause.ruleId, clause]))

export function getRule9ClauseById(ruleId) {
  return CLAUSE_MAP9.get(ruleId) || null
}

export function getRule9Clauses() {
  return RULE_9_CLAUSES
}

// Date-versioned clause selection reusing the registry's inclusive
// effective-period semantics. Future clause versions are never selected.
export function getRule9ClausesForDate(asOfDate) {
  return RULE_9_CLAUSES.filter((clause) => isRuleActiveOn(clause, asOfDate))
}

export function filterRule9ClausesByDate(clauses, asOfDate) {
  return clauses.filter((clause) => isRuleActiveOn(clause, asOfDate))
}