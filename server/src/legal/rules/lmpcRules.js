// Foundational Legal Metrology (Packaged Commodities) Rules, 2011 rule inventory.
//
// IMPORTANT SCOPING NOTE:
// The rules below are REGISTRY PLACEHOLDERS. They identify the legal rule
// categories that the compliance engine will target, and carry provenance.
// They intentionally do NOT encode full detailed legal checks. No unsupported
// exact effective dates are fabricated: base 2011 rules use effectiveFrom=null
// (no fabricated commencement date). Only officially-verified amendment
// versions carry exact dates (see lmpcAmendments.js).
//
// These entries are not a complete or authoritative statement of law.

import {
  LEGAL_DOMAIN_VALUES,
  COMPLIANCE_STATUS,
} from '../compliance/complianceTypes.js'

// Evidence-field identifiers that the Rule 6 declaration framework can target.
// These are identifiers, NOT unconditional legal requirements — whether a given
// declaration is mandatory depends on the commodity/context and on future
// domain-specific rules.
export const MANDATORY_DECLARATION_IDENTIFIERS = Object.freeze([
  'manufacturerName',
  'manufacturerAddress',
  'packerName',
  'packerAddress',
  'importerName',
  'importerAddress',
  'countryOfOrigin',
  'commonGenericName',
  'netQuantity',
  'monthYearOfManufacture',
  'dateOfPacking',
  'bestBefore',
  'useBy',
  'mrp',
  'consumerCarePhone',
  'consumerCareEmail',
  'unitSalePrice',
  'dimensions',
])

function assertEnum(value, values, label) {
  if (!values.includes(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return value
}

// Shared provenance for every base rule.
const OFFICIAL_SOURCE = Object.freeze({
  sourceAuthority: 'Department of Consumer Affairs',
  act: 'Legal Metrology Act, 2009',
  rules: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  sourceDocument:
    'Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)',
  sourceUrl: 'https://www.indiacode.nic.in/',
  verified: true,
})

// Default stance when required evidence is missing: REVIEW, never assume.
const DEFAULT_EVIDENCE_MISSING = COMPLIANCE_STATUS.REVIEW

export const FOUNDATIONAL_RULES = Object.freeze(
  [
    {
      ruleId: 'LMPC-RULE-3',
      ruleNumber: '3',
      clause: '3',
      title: 'Applicability and exemptions',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Defines the scope and exemptions of the Rules, including the retail-package (Chapter II) applicability and industrial/institutional quantities outside the retail scope.',
      checkType: 'CONTEXTUAL',
      applicability: {
        kind: 'RULE3_CHAPTER_II_SCOPE',
        exemptConsumerTypes: ['INDUSTRIAL', 'INSTITUTIONAL'],
      },
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      note:
        'Foundation entry. Exact exemption conditions and any exact commencement date are intentionally not encoded in this step.',
    },
    {
      ruleId: 'LMPC-RULE-4',
      ruleNumber: '4',
      clause: '4',
      title: 'Pre-packing and sale applicability',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Governs the applicability of declaration obligations to pre-packing for sale and the sale of packaged commodities.',
      checkType: 'CONTEXTUAL',
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      note: 'Foundation entry. Full Rule 4 checks are implemented in a later step.',
    },
    {
      ruleId: 'LMPC-RULE-6',
      ruleNumber: '6',
      clause: '6',
      title: 'Mandatory declarations',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Specifies the declarations that must appear on a retail package. Each declaration identifier below is evidence only; applicability depends on commodity/context.',
      checkType: 'EVIDENCE_FIELD',
      declarationIdentifiers: MANDATORY_DECLARATION_IDENTIFIERS,
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      note:
        'Declarations are evidence-field identifiers, not unconditional requirements. Later steps attach commodity-specific rule 6 applicability.',
    },
    {
      ruleId: 'LMPC-RULE-7',
      ruleNumber: '7',
      clause: '7',
      title: 'Minimum height of numerals and letters',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Prescribes minimum heights for numerals and letters used in mandatory declarations.',
      checkType: 'PHYSICAL_MEASUREMENT',
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      evidenceLimitations: [
        'Physical font size in millimetres cannot be measured from a normal photograph without physical scale/calibration. Will return REVIEW unless calibrated measurement is available.',
      ],
      note: 'Foundation entry. Minimum heights and units encoded in a later step.',
    },
    {
      ruleId: 'LMPC-RULE-8',
      ruleNumber: '8',
      clause: '8',
      title: 'Principal display panel and declaration placement',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Requires mandatory declarations to appear on the principal display panel and specifies placement.',
      checkType: 'PHOTO_ASSESSABLE',
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      evidenceLimitations: [
        'Placement assessment is most reliable when the full panel is visible in the image.',
      ],
      note: 'Foundation entry. Panel-area/PDP checks are implemented in a later step.',
    },
    {
      ruleId: 'LMPC-RULE-9',
      ruleNumber: '9',
      clause: '9',
      title: 'Manner of declaration, legibility and contrast',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Prescribes the manner of declarations — legibility, readability, and contrast against the background.',
      checkType: 'PHOTO_ASSESSABLE',
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      evidenceLimitations: [
        'Legibility/contrast can only be assessed from an image in clear view; degraded images return REVIEW.',
      ],
      note: 'Foundation entry. Legibility heuristics are implemented in a later step.',
    },
    {
      ruleId: 'LMPC-RULE-11',
      ruleNumber: '11',
      clause: '11',
      title: 'Net quantity principles',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Establishes principles for net quantity measurement and declaration of packaged commodities.',
      checkType: 'MEASUREMENT_DEPENDENT',
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      evidenceLimitations: [
        'Actual physical net quantity CANNOT be determined from a package photograph. PASS/FAIL requires a validated measurement source; otherwise REVIEW.',
      ],
      note: 'Foundation entry. Quantity right-sizing checks are implemented in a later step.',
    },
    {
      ruleId: 'LMPC-RULE-12',
      ruleNumber: '12',
      clause: '12',
      title: 'Expression of quantity',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Prescribes how net quantity must be expressed on the package (units and format).',
      checkType: 'EVIDENCE_FIELD',
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      note: 'Foundation entry. Unit-format checks are implemented in a later step.',
    },
    {
      ruleId: 'LMPC-SCHEDULE-1',
      ruleNumber: 'First Schedule',
      clause: 'First Schedule',
      title: 'First Schedule — Maximum permissible error framework',
      category: assertEnum('GENERAL_LMPC', LEGAL_DOMAIN_VALUES, 'category'),
      requirement:
        'Defines the maximum permissible error framework applied to packaged commodity quantity.',
      checkType: 'MEASUREMENT_DEPENDENT',
      applicability: {},
      effectiveFrom: null,
      effectiveTo: null,
      sourceAuthority: OFFICIAL_SOURCE.sourceAuthority,
      act: OFFICIAL_SOURCE.act,
      rules: OFFICIAL_SOURCE.rules,
      sourceDocument: OFFICIAL_SOURCE.sourceDocument,
      sourceUrl: OFFICIAL_SOURCE.sourceUrl,
      verified: true,
      statusIfEvidenceMissing: DEFAULT_EVIDENCE_MISSING,
      evidenceLimitations: [
        'Maximum permissible error evaluation requires calibrated physical measurement; photograph-only input returns REVIEW.',
      ],
      note: 'Foundation entry. Tolerance lookups are implemented in a later step with official Schedule 1 values.',
    },
  ].map(Object.freeze),
)

export const FOUNDATIONAL_RULE_COUNT = FOUNDATIONAL_RULES.length