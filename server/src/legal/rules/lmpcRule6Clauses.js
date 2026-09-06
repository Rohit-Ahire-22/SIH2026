// Clause-level Rule 6 representation.
//
// Rule 6 of the Legal Metrology (Packaged Commodities) Rules, 2011 lists the
// declarations a retail package must carry. This module represents individual
// Rule 6 requirements independently so the compliance engine can evaluate each
// one. It deliberately distinguishes:
//
//   requirement      - the legal declaration category (what the law requires)
//   evidenceFields   - which Product/OCR evidence can speak to it
//   applicability    - context needed before the requirement applies
//   automationLevel  - what the automated pipeline can responsibly evaluate
//
// SCOPE / VERIFICATION NOTES:
// - These entries assert the EXISTENCE of well-established Rule 6 declaration
//   categories (name/address of the responsible party, common/generic name,
//   net quantity, dates, MRP, consumer care, country of origin for imports,
//   dimensions, unit sale price) as verified against the official Rules 2011
//   material documented in this project.
// - No exact Rule 6 sub-clause NUMBER is asserted (clauseNumberVerified=false):
//   renumbering/merging across amendments is a legal fact that must be
//   reconciled from the official Gazette text before any numeric clause is
//   claimed. Never guess a clause number.
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

// Non-exhaustive "what may not apply" notes. Nothing here is asserted as a
// binding legal exemption; it documents where applicability genuinely depends
// on context that has not been fully reconciled from official text.
function baseClause(input) {
  return Object.freeze({
    ruleNumber: '6',
    checkType: 'EVIDENCE_FIELD',
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

export const RULE_6_CLAUSES = Object.freeze(
  [
    baseClause({
      ruleId: 'LMPC-RULE6-manufacturerName',
      key: 'manufacturerName',
      clause: '6 (name of manufacturer, packer or importer)',
      title: 'Name of manufacturer / packer / importer',
      requirement:
        'Requires the retail package to declare the name of the manufacturer, packer or importer (as applicable to the packing arrangement).',
      evidenceFields: ['manufacturerName', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Extraction cannot always distinguish manufacturer vs packer vs importer; ambiguity is preserved and resolved to REVIEW where legally necessary.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-manufacturerAddress',
      key: 'manufacturerAddress',
      clause: '6 (address of manufacturer, packer or importer)',
      title: 'Address of manufacturer / packer / importer',
      requirement:
        'Requires the retail package to declare the address of the manufacturer, packer or importer (as applicable to the packing arrangement).',
      evidenceFields: ['manufacturerAddress', 'ocrResults'],
      automationLevel: 'MANUAL_REVIEW',
      applicability: {},
      note: 'No address extraction field exists yet; default REVIEW unless a structured address is supplied.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-countryOfOrigin',
      key: 'countryOfOrigin',
      clause: '6 (country of origin for imported products)',
      title: 'Country of origin (imported products)',
      requirement:
        'Requires an imported retail package to declare its country of origin.',
      evidenceFields: ['countryOfOrigin', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: { importStatuses: ['IMPORTED'] },
      note: 'Only the imported, non-e-commerce package-image declaration. The 2026/2027 e-commerce Rule 6(10A) filter rules remain separate in lmpcAmendments.js.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-commonGenericName',
      key: 'commonGenericName',
      clause: '6 (common or generic name)',
      title: 'Common / generic name of the commodity',
      requirement:
        'Requires the retail package to declare the common or generic name of the commodity.',
      evidenceFields: ['commonGenericName', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Product.commonGenericName added in this step as the structured evidence endpoint.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-netQuantity',
      key: 'netQuantity',
      clause: '6 (net quantity)',
      title: 'Net quantity',
      requirement:
        'Requires the retail package to declare net quantity with a valid value and unit.',
      evidenceFields: ['netQuantity', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Structural presence/validity only. No MPE or physical-quantity verification is performed at this stage.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-dateOfManufacture',
      key: 'dateOfManufacture',
      clause: '6 (month and year of manufacture)',
      title: 'Month and year of manufacture',
      requirement:
        'Requires declaration of the month and year of manufacture where applicable.',
      evidenceFields: ['dateOfManufacture', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Maps to Product.dateOfManufacture. Commodity-specific month/year applicability is not asserted here.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-dateOfPacking',
      key: 'dateOfPacking',
      clause: '6 (date of packing)',
      title: 'Date of packing',
      requirement:
        'Requires declaration of the date of packing where the commodity is packed (month/year granularity where the rules so allow).',
      evidenceFields: ['dateOfPacking', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Maps to Product.dateOfPacking.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-bestBeforeUseBy',
      key: 'expiryOrUseByDate',
      clause: '6 (best-before / use-by date)',
      title: 'Best-before / use-by date (where applicable)',
      requirement:
        'Requires declaration of a best-before or use-by date where the commodity is of a nature that requires one.',
      evidenceFields: ['expiryOrUseByDate', 'ocrResults'],
      automationLevel: 'OCR_CONTEXT',
      applicability: { kind: 'CONTEXT_REQUIRED', contextFields: ['domain', 'commodityType'] },
      note: 'Whether best-before/use-by applies depends on commodity/domain. Insufficient domain context -> REVIEW, never assumption.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-mrp',
      key: 'mrp',
      clause: '6 (maximum retail price inclusive of all taxes)',
      title: 'Maximum retail price (MRP)',
      requirement:
        'Requires declaration of the maximum retail sale price (MRP) inclusive of all taxes.',
      evidenceFields: ['mrp', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Presence/structural-validity check only. No market price comparison and no judgment on whether a price is commercially reasonable.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-consumerCare',
      key: 'consumerCareDetails',
      clause: '6 (consumer care / consumer complaints contact)',
      title: 'Consumer care contact details',
      requirement:
        'Requires declaration of consumer-care / consumer-complaints contact details where required.',
      evidenceFields: ['consumerCareDetails', 'ocrResults'],
      automationLevel: 'OCR',
      applicability: {},
      note: 'Only structured consumerCareDetails (extracted under an explicit consumer-care label) counts as evidence; a random OCR phone number is not treated as valid consumer-care evidence.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-dimensions',
      key: 'dimensions',
      clause: '6 (dimensions where sold by length/breadth/height)',
      title: 'Dimensions (where applicable)',
      requirement:
        'Requires declaration of dimensions where the commodity is sold by length, breadth or height.',
      evidenceFields: ['dimensions', 'ocrResults'],
      automationLevel: 'MANUAL_REVIEW',
      applicability: { kind: 'CONTEXT_REQUIRED', contextFields: ['dimensionsApplicable'] },
      note: 'Applicability depends on how the commodity is sold; cannot be inferred from a photograph.',
    }),
    baseClause({
      ruleId: 'LMPC-RULE6-unitSalePrice',
      key: 'unitSalePrice',
      clause: '6 (unit sale price where required)',
      title: 'Unit sale price',
      requirement:
        'Requires declaration of the unit sale price where the unit-sale-price framework applies to the package.',
      evidenceFields: ['unitSalePrice', 'mrp', 'netQuantity', 'ocrResults'],
      automationLevel: 'OCR_CONTEXT',
      applicability: { kind: 'CONTEXT_REQUIRED', contextFields: ['unitSalePriceApplicable'] },
      exceptions: {
        note: 'COMBINATION / GROUP / MULTI_PIECE packages need special unit-sale-price handling; exact official clause reconciliation is pending (reviewed in unitSalePriceService).',
      },
      note: 'Presence check only. The expected unit basis is computed deterministically by unitSalePriceService; basis applicability that cannot be reconciled from the official amendment returns REVIEW with a TODO.',
    }),
  ].map(Object.freeze),
)

export const RULE_6_CLAUSE_COUNT = RULE_6_CLAUSES.length
export const RULE_6_DECLARATION_KEYS = Object.freeze(
  RULE_6_CLAUSES.map((clause) => clause.key),
)

const CLAUSE_MAP = new Map(RULE_6_CLAUSES.map((clause) => [clause.ruleId, clause]))

export function getRule6ClauseById(ruleId) {
  return CLAUSE_MAP.get(ruleId) || null
}

export function getRule6Clauses() {
  return RULE_6_CLAUSES
}

// Date-versioned clause selection reusing the registry's inclusive
// effective-period semantics. Future clause versions are never selected.
export function getRule6ClausesForDate(asOfDate) {
  return RULE_6_CLAUSES.filter((clause) => isRuleActiveOn(clause, asOfDate))
}

export function filterRule6ClausesByDate(clauses, asOfDate) {
  return clauses.filter((clause) => isRuleActiveOn(clause, asOfDate))
}