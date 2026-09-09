// Deterministic Rule 7/8/9 clause-level compliance evaluation.
//
// This module evaluates Rules 7, 8, and 9 of the Legal Metrology (Packaged Commodities)
// Rules, 2011 using the clause-level registry created in Part 1 of Step 13A.
//
// Evidence philosophy (CRITICAL for legal defensibility):
//   PRESEST           - structured evidence value exists and satisfies the requirement
//   ABSENT_CONFIRMED  - the pipeline/explicitly confirmed the declaration is absent
//                       from the inspected package area. This can ONLY be
//                       asserted by the caller via context.confirmedAbsentFields.
//                       OCR alone can NEVER produce this.
//   UNKNOWN           - no evidence, no confirmed inspection -> REVIEW.
//
// Context flags (explicit, deterministic, never inferred):
//   context.confirmedAbsentFields  -> fields proven absent by inspection
//   context.evidence               -> structured evidence object per requirement
//
// THIS MODULE DOES NOT:
//   - Implement CV, YOLO, or principal display panel detection
//   - Perform physical millimetre font measurement
//   - Convert OCR confidence to legal legibility or font-size compliance
//   - invent numerical thresholds or clause numbers
//   - assume absence based on OCR non-detection

import {
  COMPLIANCE_STATUS,
  createComplianceResult,
  createLegalSource,
  createEvidence,
} from '../compliance/complianceTypes.js'
import { evaluateApplicability, isRuleApplicable } from '../applicability/applicabilityService.js'
import { normalizeDate } from '../rules/ruleRegistry.js'
import {
  RULE_7_CLAUSES,
  RULE_7_CLAUSE_COUNT,
  RULE_7_KEYS,
} from '../rules/lmpcRule7Clauses.js'
import {
  RULE_8_CLAUSES,
  RULE_8_CLAUSE_COUNT,
  RULE_8_KEYS,
} from '../rules/lmpcRule8Clauses.js'
import {
  RULE_9_CLAUSES,
  RULE_9_CLAUSE_COUNT,
  RULE_9_KEYS,
} from '../rules/lmpcRule9Clauses.js'
import { MANDATORY_DECLARATION_IDENTIFIERS } from '../rules/lmpcRules.js'
import { rule7ThresholdResolver } from '../rules/rule7ThresholdRegistry.js'
import { TRUSTED_CALIBRATION_SOURCES } from '../../services/measurementEvidenceService.js'

const { PASS, FAIL, REVIEW, NOT_APPLICABLE, PENDING } = COMPLIANCE_STATUS

export const EVIDENCE_STATE = Object.freeze({
  PRESENT: 'PRESENT',
  ABSENT_CONFIRMED: 'ABSENT_CONFIRMED',
  UNKNOWN: 'UNKNOWN',
})

// Physical millimetre font measurement is not supported in this step.
// Pixel height from OCR bounding boxes does NOT equal millimetres.
// Any check requiring physical measurement without calibration returns REVIEW.

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && value !== 'UNKNOWN'
}

function safeString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (value === undefined || value === null) return null
  if (typeof value === 'object') return value
  if (typeof value === 'number') return value
  return String(value).trim() || null
}

function readProductField(product, field) {
  if (!product || typeof product !== 'object') return undefined
  return product[field]
}

function isConfirmedAbsent(field, context) {
  const fields = context?.confirmedAbsentFields
  return Array.isArray(fields) && fields.includes(field)
}

function absentEvidenceMarker(clause) {
  return [{ field: clause.key, value: null, source: 'explicit', state: EVIDENCE_STATE.ABSENT_CONFIRMED }]
}

function evaluateGeneric(clause, product, context, requirementType) {
  if (isConfirmedAbsent(clause.key, context)) {
    return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: `${clause.key} confirmed absent by explicit inspection.` }
  }
  const evidence = readProductField(product, clause.key)
  if (hasValue(evidence)) {
    return { status: PASS, evidence: [{ field: clause.key, value: safeString(evidence), source: 'explicit' }], reason: `${clause.key} explicit evidence confirms compliance.` }
  }
  if (requirementType === 'visual_panel') {
    return { status: REVIEW, evidence: [], reason: `${clause.key} requires visual/panel determination. CV evidence is not implemented yet.` }
  } else if (requirementType === 'visual_legibility') {
    return { status: REVIEW, evidence: [], reason: `${clause.key} requires visual assessment. OCR text detection and high OCR confidence do NOT prove legal legibility.` }
  } else if (requirementType === 'medical_device') {
    return { status: REVIEW, evidence: [], reason: `${clause.key} medical-device-specific evidence/threshold information is unavailable.` }
  }
  return { status: REVIEW, evidence: [], reason: `Insufficient evidence for ${clause.key}.` }
}

// A calibration is legally trusted ONLY when its source is explicitly accepted
// by the server-side allowlist. The calibrationTrust field is informational;
// the authority decision is made here against server-controlled data so a
// caller can never manufacture trust by setting a boolean or a string.
function isTrustedCalibration(measurementEvidence) {
  if (!measurementEvidence || !measurementEvidence.calibration) return false
  return TRUSTED_CALIBRATION_SOURCES.has(measurementEvidence.calibration.source)
}

function evaluateMeasurement(clause, product, context, measurementEvidence) {
  if (isConfirmedAbsent(clause.key, context)) {
    return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: `${clause.key} confirmed absent by explicit inspection.` }
  }

  // Explicit trusted evidence on the product takes precedence over the
  // measurement path (consistent with every other clause).
  const explicitEvidence = readProductField(product, clause.key)
  if (hasValue(explicitEvidence)) {
    return { status: PASS, evidence: [{ field: clause.key, value: safeString(explicitEvidence), source: 'explicit' }], reason: `${clause.key} explicit evidence confirms compliance.` }
  }

  if (!measurementEvidence || measurementEvidence.measurementStatus === 'UNAVAILABLE') {
    return { status: REVIEW, evidence: [], reason: `${clause.key} requires physical measurement. No measurement evidence found.` }
  }

  if (measurementEvidence.measurementStatus === 'UNCALIBRATED') {
    // Find if we have pixel evidence to show in reason
    const ms = measurementEvidence.measurements?.find(m => m.target === clause.key)
    if (ms) {
      return { 
        status: REVIEW, 
        evidence: [{ field: clause.key, value: `${ms.pixelHeight} px`, source: 'measurement' }], 
        reason: `${clause.key} measured at ${ms.pixelHeight} px. No legitimate physical calibration available. Pixels cannot safely be interpreted as millimetres.` 
      }
    }
    return { status: REVIEW, evidence: [], reason: `${clause.key} requires physical measurement/calibration. Image is uncalibrated.` }
  }

  if (measurementEvidence.measurementStatus === 'UNCERTAIN') {
    return { status: REVIEW, evidence: [], reason: `${clause.key} measurement is UNCERTAIN (e.g. malformed calibration, perspective distortion, or unreliable uncertainty). Cannot safely evaluate. Manual review required.` }
  }

  if (measurementEvidence.measurementStatus === 'CALIBRATED') {
    const ms = measurementEvidence.measurements?.find(m => m.target === clause.key)
    if (!ms || ms.physicalHeight == null) {
      return { status: REVIEW, evidence: [], reason: `${clause.key} was not successfully measured despite valid calibration.` }
    }

    if (ms.status === 'UNCERTAIN') {
      const valueLabel = ms.physicalHeight == null ? 'n/a' : `${ms.physicalHeight.toFixed(2)} ${ms.unit} ± ${ms.uncertainty.toFixed(2)}`
      return {
        status: REVIEW,
        evidence: [{ field: clause.key, value: `${ms.pixelHeight} px`, source: 'measurement' }],
        reason: `${clause.key} physical measurement is unreliable (${valueLabel}). Cannot safely evaluate. Manual review required.`,
      }
    }

    // Trust boundary #1: the calibration source must be accepted by the
    // trusted architecture. Untrusted calibration can never produce PASS/FAIL.
    if (!isTrustedCalibration(measurementEvidence)) {
      return {
        status: REVIEW,
        evidence: [{ field: clause.key, value: `${ms.physicalHeight.toFixed(2)} ${ms.unit}`, source: 'measurement', bbox: ms.bbox }],
        reason: `Physical measurement is available (${ms.physicalHeight.toFixed(2)} ${ms.unit} ± ${ms.uncertainty.toFixed(2)}), but the calibration source is not trusted by the compliance architecture (calibrationTrust: ${measurementEvidence.calibrationTrust ?? 'UNKNOWN'}). Manual review required.`,
      }
    }

    // Trust boundary #2: a verified legal threshold must come from the trusted
    // legal registry ONLY. Caller-supplied context.thresholds is never used for
    // definitive PASS/FAIL.
    const threshold = rule7ThresholdResolver.getVerifiedRule7Threshold(clause.ruleId)
    if (threshold === undefined || threshold === null) {
      return {
        status: REVIEW,
        evidence: [{ field: clause.key, value: `${ms.physicalHeight.toFixed(2)} ${ms.unit}`, source: 'measurement', bbox: ms.bbox }],
        reason: 'Physical measurement is available, but no verified legal Rule 7 threshold is currently encoded in the trusted legal registry.',
      }
    }

    // Uncertainty-aware deterministic comparison: the whole measurement band
    // must be above (PASS) or below (FAIL) the verified threshold.
    const uncertainty = ms.uncertainty || 0
    const low = ms.physicalHeight - uncertainty
    const high = ms.physicalHeight + uncertainty
    const measuredLabel = `${ms.physicalHeight.toFixed(2)} ${ms.unit} ± ${uncertainty.toFixed(2)}`
    if (low >= threshold) {
      return {
        status: PASS,
        evidence: [{ field: clause.key, value: `${ms.physicalHeight.toFixed(2)} ${ms.unit}`, source: 'measurement', bbox: ms.bbox }],
        reason: `Measured height: ${measuredLabel}. Meets required threshold of ${threshold} ${ms.unit}.`,
      }
    }
    if (high < threshold) {
      return {
        status: FAIL,
        evidence: [{ field: clause.key, value: `${ms.physicalHeight.toFixed(2)} ${ms.unit}`, source: 'measurement', bbox: ms.bbox }],
        reason: `Measured height: ${measuredLabel}. Fails required threshold of ${threshold} ${ms.unit}.`,
      }
    }
    return {
      status: REVIEW,
      evidence: [{ field: clause.key, value: `${ms.physicalHeight.toFixed(2)} ${ms.unit}`, source: 'measurement', bbox: ms.bbox }],
      reason: `Measured height: ${measuredLabel} straddles the verified threshold of ${threshold} ${ms.unit}; the uncertainty band prevents a reliable legal determination. Manual review required.`,
    }
  }

  return { status: REVIEW, evidence: [], reason: `Insufficient measurement evidence for ${clause.key}.` }
}

// --- Helper: Check if any clause in a set has a given key ---

function findClauseByKey(clauses, key) {
  return clauses.find((c) => c.key === key) || null
}

// --- Rule 7 Evaluators ---

function numeralLetterHeightEvaluation(clause, product, context, measurementEvidence) {
  return evaluateMeasurement(clause, product, context, measurementEvidence)
}

function smallPackageEvaluation(clause, product, context, measurementEvidence) {
  return evaluateMeasurement(clause, product, context, measurementEvidence)
}

function letterHeightEvaluation(clause, product, context, measurementEvidence) {
  return evaluateMeasurement(clause, product, context, measurementEvidence)
}

function letterWidthRatioEvaluation(clause, product, context, measurementEvidence) {
  return evaluateMeasurement(clause, product, context, measurementEvidence)
}

function quantityTypeDependentSizeEvaluation(clause, product, context, measurementEvidence) {
  return evaluateMeasurement(clause, product, context, measurementEvidence)
}

function medicalDeviceOverrideEvaluation(clause, product, context) {
  const domain = context?.domain
  if (domain === 'medical_device') {
    return evaluateGeneric(clause, product, context, 'medical_device')
  }
  return {
    status: REVIEW,
    evidence: [],
    reason: 'Medical-device override: context.domain is not "medical_device", or no medical-device-specific evidence available.',
  }
}

// --- Rule 8 Evaluators ---

function pdpLocationEvaluation(clause, product, context, fusedEvidence) {
  if (!fusedEvidence || !fusedEvidence.visualInferenceStatus) {
    return evaluateGeneric(clause, product, context, 'visual_panel')
  }

  if (fusedEvidence.visualInferenceStatus === 'UNAVAILABLE_MODEL_MISSING' || fusedEvidence.visualInferenceStatus !== 'SUCCESS') {
    return {
      status: REVIEW,
      evidence: [],
      reason: `PDP detection requires visual model. Current status: ${fusedEvidence.visualInferenceStatus}. Safe fallback to REVIEW.`
    }
  }

  if (!fusedEvidence.pdpDetected) {
    return {
      status: REVIEW,
      evidence: [],
      reason: 'PDP not detected by visual model.'
    }
  }

  if (fusedEvidence.pdpConfidence < 0.6) { // Arbitrary conservative threshold for low-confidence PDP
    return {
      status: REVIEW,
      evidence: [{ field: 'pdp', value: 'Detected', source: 'visual', bbox: fusedEvidence.pdpBbox, confidence: fusedEvidence.pdpConfidence }],
      reason: `PDP detected but confidence (${fusedEvidence.pdpConfidence}) is too low to safely evaluate.`
    }
  }

  const fieldsInside = []
  const fieldsPartial = []
  const fieldsOutside = []
  const fieldsUnknown = []
  const lowConfidenceFields = []

  let hasRequiredDeclarations = false

  if (fusedEvidence.fusedFields) {
    for (const [key, data] of Object.entries(fusedEvidence.fusedFields)) {
      // Only declarations that belong to the mandatory declaration identifiers
      // of the legal/compliance architecture (Rule 6) are relevant to this
      // Rule 8 pdpLocation clause. Unrelated, promotional, or ambient OCR text
      // must not determine the pdpLocation outcome.
      if (!MANDATORY_DECLARATION_IDENTIFIERS.includes(key)) continue
      if (data.value && data.value !== 'REVIEW') {
        hasRequiredDeclarations = true
        if (data.confidence !== undefined && data.confidence < 0.8) {
          lowConfidenceFields.push(key)
        }
        if (data.spatialRelationToPdp === 'INSIDE') {
          fieldsInside.push(key)
        } else if (data.spatialRelationToPdp === 'PARTIAL') {
          fieldsPartial.push(key)
        } else if (data.spatialRelationToPdp === 'OUTSIDE') {
          fieldsOutside.push(key)
        } else {
          fieldsUnknown.push(key)
        }
      }
    }
  }

  if (!hasRequiredDeclarations) {
    return {
      status: REVIEW,
      evidence: [{ field: 'pdp', value: 'Detected', source: 'visual', bbox: fusedEvidence.pdpBbox }],
      reason: 'PDP confidently detected, but no OCR declarations found to verify spatial relationship.'
    }
  }

  if (lowConfidenceFields.length > 0) {
    return {
      status: REVIEW,
      evidence: [{ field: 'pdp', value: 'Detected', source: 'visual', bbox: fusedEvidence.pdpBbox }],
      reason: `PDP detected, but OCR declarations (${lowConfidenceFields.join(', ')}) have low confidence. Cannot safely evaluate.`
    }
  }

  if (fieldsOutside.length > 0) {
    return {
      status: REVIEW,
      evidence: [{ field: 'pdp', value: 'Detected', source: 'visual', bbox: fusedEvidence.pdpBbox }],
      reason: `PDP detected, but declarations (${fieldsOutside.join(', ')}) are OUTSIDE. Verify if they are legally required to be inside.`
    }
  }

  if (fieldsPartial.length > 0) {
    return {
      status: REVIEW,
      evidence: [{ field: 'pdp', value: 'Detected', source: 'visual', bbox: fusedEvidence.pdpBbox }],
      reason: `PDP detected, but declarations (${fieldsPartial.join(', ')}) are PARTIAL. Cannot safely evaluate.`
    }
  }

  if (fieldsUnknown.length > 0) {
    return {
      status: REVIEW,
      evidence: [{ field: 'pdp', value: 'Detected', source: 'visual', bbox: fusedEvidence.pdpBbox }],
      reason: `PDP detected, but declarations (${fieldsUnknown.join(', ')}) have an UNKNOWN spatial relationship to the PDP. Cannot safely evaluate.`
    }
  }

  if (fieldsInside.length > 0) {
    return {
      status: PASS,
      evidence: [{ field: 'pdp', value: 'Detected', source: 'visual', bbox: fusedEvidence.pdpBbox }, { field: 'placement', value: 'Inside PDP', source: 'fusion', fields: fieldsInside }],
      reason: `PDP confidently detected and all extracted mandatory declarations (${fieldsInside.join(', ')}) are confidently INSIDE.`
    }
  }

  return {
    status: REVIEW,
    evidence: [],
    reason: 'PDP detected, but spatial relationship of declarations is UNKNOWN or ambiguous.'
  }
}

function declarationPlacementEvaluation(clause, product, context, fusedEvidence) {
  // Current visual model only detects PDP boundaries, not obstruction/readability
  return {
    status: REVIEW,
    evidence: [],
    reason: 'Visual model does not reliably detect obstruction, graphics covering declarations, or readability. Manual review required.'
  }
}

function surroundingSpaceEvaluation(clause, product, context) {
  return evaluateGeneric(clause, product, context, 'measurement')
}

function presentedDeclarationsEvaluation(clause, product, context) {
  return evaluateGeneric(clause, product, context, 'visual_legibility')
}

function wrapperVisibilityEvaluation(clause, product, context) {
  return evaluateGeneric(clause, product, context, 'visual_panel')
}

// --- Rule 9 Evaluators ---

function legibilityEvaluation(clause, product, context) {
  return evaluateGeneric(clause, product, context, 'visual_legibility')
}

function prominenceEvaluation(clause, product, context) {
  return evaluateGeneric(clause, product, context, 'visual_legibility')
}

function contrastingPresentationEvaluation(clause, product, context) {
  return evaluateGeneric(clause, product, context, 'visual_legibility')
}

function languageFrameworkEvaluation(clause, product, context) {
  return evaluateGeneric(clause, product, context, 'visual_legibility')
}

// --- Main Evaluator ---

export function evaluateRules789({
  product = {},
  context = {},
  evidence = {},
  fusedEvidence = null,
  measurementEvidence = null,
  asOfDate,
}) {
  const day = normalizeDate(asOfDate)

  // 1. Applicability check using existing service
  const applicabilityResult = evaluateApplicability(context)
  if (applicabilityResult.status === 'NOT_APPLICABLE') {
    return {
      rules: ['7', '8', '9'],
      status: NOT_APPLICABLE,
      asOfDate: day,
      reason: applicabilityResult.reason,
      source: createLegalSource({ ruleNumber: '7/8/9' }),
      checks: [],
    }
  }

  if (applicabilityResult.status === 'REVIEW') {
    return {
      rules: ['7', '8', '9'],
      status: REVIEW,
      asOfDate: day,
      reason: applicabilityResult.reason,
      source: createLegalSource({ ruleNumber: '7/8/9' }),
      checks: [],
    }
  }

  // 2. Evaluate each Rule 7 clause
  const rule7Checks = []
  for (const clause of RULE_7_CLAUSES) {
    // Check applicability per rule
    const applicability = isRuleApplicable(clause, context)
    if (applicability.status === 'NOT_APPLICABLE') {
      rule7Checks.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: NOT_APPLICABLE,
          reason: applicability.reason,
          evidence: [],
          source: buildSource(clause),
          clause: clause.clause,
          requirement: clause.requirement,
          automationLevel: clause.automationLevel,
        }),
      )
      continue
    }
    if (applicability.status === 'REVIEW') {
      rule7Checks.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: REVIEW,
          reason: applicability.reason,
          evidence: [],
          source: buildSource(clause),
          clause: clause.clause,
          requirement: clause.requirement,
          automationLevel: clause.automationLevel,
        }),
      )
      continue
    }

    // Evaluate based on clause key
    let outcome
    switch (clause.key) {
      case 'numeralLetterHeight':
        outcome = numeralLetterHeightEvaluation(clause, product, context, measurementEvidence)
        break
      case 'smallPackage':
        outcome = smallPackageEvaluation(clause, product, context, measurementEvidence)
        break
      case 'letterHeight':
        outcome = letterHeightEvaluation(clause, product, context, measurementEvidence)
        break
      case 'letterWidthRatio':
        outcome = letterWidthRatioEvaluation(clause, product, context, measurementEvidence)
        break
      case 'quantityTypeDependentSize':
        outcome = quantityTypeDependentSizeEvaluation(clause, product, context, measurementEvidence)
        break
      case 'medicalDeviceOverride':
        outcome = medicalDeviceOverrideEvaluation(clause, product, context)
        break
      default:
        outcome = {
          status: REVIEW,
          evidence: [],
          reason: 'No evaluator registered for this Rule 7 clause key yet.',
        }
    }

    rule7Checks.push(
      createComplianceResult({
        ruleId: clause.ruleId,
        status: outcome.status,
        reason: outcome.reason,
        evidence: outcome.evidence,
        source: buildSource(clause),
        clause: clause.clause,
        requirement: clause.requirement,
        automationLevel: clause.automationLevel,
      }),
    )
  }

  // 3. Evaluate each Rule 8 clause
  const rule8Checks = []
  for (const clause of RULE_8_CLAUSES) {
    const applicability = isRuleApplicable(clause, context)
    if (applicability.status === 'NOT_APPLICABLE') {
      rule8Checks.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: NOT_APPLICABLE,
          reason: applicability.reason,
          evidence: [],
          source: buildSource(clause),
          clause: clause.clause,
          requirement: clause.requirement,
          automationLevel: clause.automationLevel,
        }),
      )
      continue
    }
    if (applicability.status === 'REVIEW') {
      rule8Checks.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: REVIEW,
          reason: applicability.reason,
          evidence: [],
          source: buildSource(clause),
          clause: clause.clause,
          requirement: clause.requirement,
          automationLevel: clause.automationLevel,
        }),
      )
      continue
    }

    let outcome
    switch (clause.key) {
      case 'pdpLocation':
        outcome = pdpLocationEvaluation(clause, product, context, fusedEvidence)
        break
      case 'declarationPlacement':
        outcome = declarationPlacementEvaluation(clause, product, context, fusedEvidence)
        break
      case 'surroundingSpace':
        outcome = surroundingSpaceEvaluation(clause, product, context)
        break
      case 'presentedDeclarations':
        outcome = presentedDeclarationsEvaluation(clause, product, context)
        break
      case 'wrapperVisibility':
        outcome = wrapperVisibilityEvaluation(clause, product, context)
        break
      default:
        outcome = {
          status: REVIEW,
          evidence: [],
          reason: 'No evaluator registered for this Rule 8 clause key yet.',
        }
    }

    rule8Checks.push(
      createComplianceResult({
        ruleId: clause.ruleId,
        status: outcome.status,
        reason: outcome.reason,
        evidence: outcome.evidence,
        source: buildSource(clause),
        clause: clause.clause,
        requirement: clause.requirement,
        automationLevel: clause.automationLevel,
      }),
    )
  }

  // 4. Evaluate each Rule 9 clause
  const rule9Checks = []
  for (const clause of RULE_9_CLAUSES) {
    const applicability = isRuleApplicable(clause, context)
    if (applicability.status === 'NOT_APPLICABLE') {
      rule9Checks.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: NOT_APPLICABLE,
          reason: applicability.reason,
          evidence: [],
          source: buildSource(clause),
          clause: clause.clause,
          requirement: clause.requirement,
          automationLevel: clause.automationLevel,
        }),
      )
      continue
    }
    if (applicability.status === 'REVIEW') {
      rule9Checks.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: REVIEW,
          reason: applicability.reason,
          evidence: [],
          source: buildSource(clause),
          clause: clause.clause,
          requirement: clause.requirement,
          automationLevel: clause.automationLevel,
        }),
      )
      continue
    }

    let outcome
    switch (clause.key) {
      case 'legibility':
        outcome = legibilityEvaluation(clause, product, context)
        break
      case 'prominence':
        outcome = prominenceEvaluation(clause, product, context)
        break
      case 'contrastingPresentation':
        outcome = contrastingPresentationEvaluation(clause, product, context)
        break
      case 'languageFramework':
        outcome = languageFrameworkEvaluation(clause, product, context)
        break
      default:
        outcome = {
          status: REVIEW,
          evidence: [],
          reason: 'No evaluator registered for this Rule 9 clause key yet.',
        }
    }

    rule9Checks.push(
      createComplianceResult({
        ruleId: clause.ruleId,
        status: outcome.status,
        reason: outcome.reason,
        evidence: outcome.evidence,
        source: buildSource(clause),
        clause: clause.clause,
        requirement: clause.requirement,
        automationLevel: clause.automationLevel,
      }),
    )
  }

  // 5. Determine overall status using worst-status ranking
  function statusRank(status) {
    const order = { [FAIL]: 1, [REVIEW]: 2, [PASS]: 3, [NOT_APPLICABLE]: 4, [PENDING]: 5 }
    return order[status] ?? 5
  }

  function worstStatus(statuses) {
    const executed = statuses.filter((s) => s !== NOT_APPLICABLE)
    if (executed.length === 0) return NOT_APPLICABLE
    return executed.sort((a, b) => statusRank(a) - statusRank(b))[0]
  }

  const allChecks = [...rule7Checks, ...rule8Checks, ...rule9Checks]
  const statuses = allChecks.map((c) => c.status)
  const overall = worstStatus(statuses)

  // 6. Build reason string
  const applicableCount = allChecks.filter((c) => c.status !== NOT_APPLICABLE).length
  const reason =
    overall === NOT_APPLICABLE
      ? applicabilityResult.reason
      : overall === REVIEW
        ? `Rule 7/8/9 evaluated on ${day}; ${applicableCount} applicable clause checks returned REVIEW.`
        : overall === PASS
          ? `Rule 7/8/9 evaluated on ${day}; ${applicableCount} applicable clause checks passed.`
          : `Rule 7/8/9 evaluated on ${day}; some checks failed.`

  return {
    rules: ['7', '8', '9'],
    status: overall,
    asOfDate: day,
    reason,
    source: buildSource789(),
    checks: [...rule7Checks, ...rule8Checks, ...rule9Checks],
  }
}

// --- Source builders ---

function buildSource(clause) {
  return {
    ...createLegalSource({ ruleNumber: '7/8/9', ruleId: clause.ruleId }),
    clause: clause.clause,
    effectiveFrom: clause.effectiveFrom ?? null,
    effectiveTo: clause.effectiveTo ?? null,
    sourceDocument: clause.sourceDocument ?? 'Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)',
    sourceUrl: clause.sourceUrl ?? 'https://www.indiacode.nic.in/',
  }
}

function buildSource789() {
  return {
    ...createLegalSource({ ruleNumber: '7/8/9' }),
    sourceDocument:
      'Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)',
    sourceUrl: 'https://www.indiacode.nic.in/',
  }
}