// Versioned amendments to the Legal Metrology (Packaged Commodities) Rules,
// 2011. This file demonstrates the versioned-rule architecture using the
// officially-notified e-commerce country-of-origin provisions.
//
// Official facts encoded here (per the project's verified official material):
// - The 13 February 2026 amendment (Department of Consumer Affairs, Official
//   Gazette of India) inserted a country-of-origin provision (Rule 6(10A))
//   requiring e-commerce listings of imported products to expose searchable /
//   sortable country-of-origin filtering. It became effective 2026-07-01.
// - An officially notified replacement version becomes effective 2027-07-01.
//
// The two versions are intentionally represented as SEPARATE rules with an
// explicit effective period — they are never merged.

import { LEGAL_DOMAIN_VALUES, COMPLIANCE_STATUS } from '../compliance/complianceTypes.js'

const AMENDMENT_SOURCE_AUTHORITY = 'Department of Consumer Affairs'
const OFFICIAL_GAZETTE_URL = 'https://egazette.gov.in'

export const COUNTRY_OF_ORIGIN_2026_RULE = Object.freeze({
  ruleId: 'LMPC-RULE6-10A-2026',
  ruleNumber: '6',
  clause: '6(10A)',
  title: 'Country of origin — e-commerce searchable/sortable filter (2026)',
  category: 'GENERAL_LMPC',
  requirement:
    'E-commerce listings of imported packaged commodities must expose a searchable/sortable country-of-origin attribute (Rule 6(10A), inserted by the officially-notified 2026 amendment). Applicable to e-commerce listings of imported products; not a general package-image declaration.',
  checkType: 'CONTEXTUAL',
  declarationIdentifiers: ['countryOfOrigin'],
  applicability: {
    importStatuses: ['IMPORTED'],
  },
  effectiveFrom: '2026-07-01',
  effectiveTo: '2027-06-30',
  supersededBy: 'LMPC-RULE6-10A-2027',
  sourceAuthority: AMENDMENT_SOURCE_AUTHORITY,
  act: 'Legal Metrology Act, 2009',
  rules: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  sourceDocument:
    'Official Gazette of India — Department of Consumer Affairs Notification, 13 February 2026 (amendment to the Legal Metrology (Packaged Commodities) Rules, 2011)',
  sourceUrl: OFFICIAL_GAZETTE_URL,
  verified: true,
  statusIfEvidenceMissing: COMPLIANCE_STATUS.REVIEW,
  note:
    'Exact full text not reproduced; only the verified official facts (notification date, insertion of Rule 6(10A), e-commerce country-of-origin filtering for imported products, effective 2026-07-01) are encoded.',
})

export const COUNTRY_OF_ORIGIN_2027_RULE = Object.freeze({
  ruleId: 'LMPC-RULE6-10A-2027',
  ruleNumber: '6',
  clause: '6(10A)',
  title: 'Country of origin — e-commerce searchable/sortable filter (2027 replacement)',
  category: 'GENERAL_LMPC',
  requirement:
    'Replacement version of the e-commerce country-of-origin provision (Rule 6(10A)) as officially notified, effective 2027-07-01. Same subject as the 2026 version; represented as a separate effective period.',
  checkType: 'CONTEXTUAL',
  declarationIdentifiers: ['countryOfOrigin'],
  applicability: {
    importStatuses: ['IMPORTED'],
  },
  effectiveFrom: '2027-07-01',
  effectiveTo: null,
  supersedes: ['LMPC-RULE6-10A-2026'],
  sourceAuthority: AMENDMENT_SOURCE_AUTHORITY,
  act: 'Legal Metrology Act, 2009',
  rules: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  sourceDocument:
    'Official Gazette of India — Department of Consumer Affairs Notification (2027 replacement of the e-commerce country-of-origin provision)',
  sourceUrl: OFFICIAL_GAZETTE_URL,
  verified: true,
  statusIfEvidenceMissing: COMPLIANCE_STATUS.REVIEW,
  note:
    'Exact full text not reproduced; only the verified official facts (notified replacement, effective 2027-07-01) are encoded.',
})

export const LMPC_AMENDMENTS = Object.freeze([
  COUNTRY_OF_ORIGIN_2026_RULE,
  COUNTRY_OF_ORIGIN_2027_RULE,
])

export const LMPC_AMENDMENT_COUNT = LMPC_AMENDMENTS.length