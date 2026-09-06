// Legal-domain types for the compliance layer.
// These are engineering types describing decision data, NOT legal advice.
// Legal determination never happens inside the LLM/OCR stack; it happens
// against versioned rules in this legal layer.

export const COMPLIANCE_STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  REVIEW: 'REVIEW',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PENDING: 'PENDING',
})

export const COMPLIANCE_STATUS_VALUES = Object.freeze(
  Object.values(COMPLIANCE_STATUS),
)

export function isValidComplianceStatus(value) {
  return COMPLIANCE_STATUS_VALUES.includes(value)
}

// Special regulatory domains the architecture must be able to isolate.
// These are identifiers only; no domain-specific legal checks exist yet.
export const LEGAL_DOMAIN_VALUES = Object.freeze([
  'GENERAL_LMPC',
  'FOOD',
  'MEDICAL_DEVICE',
  'ELECTRONIC_PRODUCT',
  'PAN_MASALA',
  'OTHER',
])

export const PACKAGE_TYPE_VALUES = Object.freeze([
  'STANDARD',
  'COMBINATION',
  'GROUP',
  'MULTI_PIECE',
  'GIFT',
  'UNKNOWN',
])

export const CONSUMER_TYPE_VALUES = Object.freeze([
  'RETAIL',
  'INDUSTRIAL',
  'INSTITUTIONAL',
  'UNKNOWN',
])

export const IMPORT_STATUS_VALUES = Object.freeze([
  'DOMESTIC',
  'IMPORTED',
  'UNKNOWN',
])

// Tri-state outcome of applicability evaluation.
// REVIEW means "cannot decide from available context" — never assume.
export const APPLICABILITY_STATUS = Object.freeze({
  APPLICABLE: 'APPLICABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  REVIEW: 'REVIEW',
})

export const APPLICABILITY_STATUS_VALUES = Object.freeze(
  Object.values(APPLICABILITY_STATUS),
)

export function isValidApplicabilityStatus(value) {
  return APPLICABILITY_STATUS_VALUES.includes(value)
}

const LEGAL_SOURCE_BASE = Object.freeze({
  sourceAuthority: 'Department of Consumer Affairs',
  act: 'Legal Metrology Act, 2009',
  rules: 'Legal Metrology (Packaged Commodities) Rules, 2011',
  verified: true,
})

// Structured legal provenance. Every compliance result carries one of these,
// kept strictly separate from product evidence.
export function createLegalSource({ ruleNumber, ruleId } = {}) {
  const source = { ...LEGAL_SOURCE_BASE }
  if (ruleNumber) source.ruleNumber = ruleNumber
  if (ruleId) source.ruleId = ruleId
  return source
}

// Structured evidence fragment. `source` is the evidence channel (e.g. 'ocr',
// 'manual', 'packaging_db') — never mixed into the legal source object.
export function createEvidence({ field, value, source = 'ocr', bbox } = {}) {
  const evidence = { field, value, source }
  if (Array.isArray(bbox) && bbox.length > 0) evidence.bbox = bbox
  return evidence
}

// Standard compliance result shape.
// {
//   ruleId, status, confidence, reason, evidence: [Evidence], source: LegalSource
// }
export function createComplianceResult({
  ruleId,
  status,
  confidence = null,
  reason = '',
  evidence = [],
  source = null,
  ...rest
}) {
  if (!isValidComplianceStatus(status)) {
    throw new Error(`Invalid compliance status: ${status}`)
  }
  if (!ruleId) {
    throw new Error('createComplianceResult requires ruleId')
  }
  return {
    ruleId,
    status,
    confidence,
    reason,
    evidence: Array.isArray(evidence) ? evidence : [evidence],
    source,
    ...rest,
  }
}

export function validateComplianceResult(result) {
  if (!result || typeof result !== 'object') return false
  if (typeof result.ruleId !== 'string' && typeof result.ruleId !== 'number') {
    return false
  }
  if (!isValidComplianceStatus(result.status)) return false
  if (!Array.isArray(result.evidence)) return false
  if (
    result.source &&
    (typeof result.source.sourceAuthority !== 'string' ||
      result.source.verified !== true)
  ) {
    return false
  }
  return true
}