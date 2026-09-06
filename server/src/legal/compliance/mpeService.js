import { COMPLIANCE_STATUS } from './complianceTypes.js'
import { normalizeNetQuantity, validateQuantity } from './netQuantityService.js'

/**
 * Maximum Permissible Error (MPE) evaluation service.
 * Determines if an observed physical measurement meets the declared quantity
 * requirements minus the allowed First Schedule tolerances.
 *
 * IMPORTANT LEGAL METROLOGY NOTE:
 * MPE cannot be evaluated solely from an OCR extraction of a package photograph.
 * A photograph provides the *declared* quantity. It does NOT provide the 
 * *actual physical* quantity inside the package. Therefore, if physical
 * measurement evidence is unavailable, this service deterministic returns REVIEW.
 * It will NEVER invent a physical observation to force a PASS.
 * 
 * Exact MPE threshold tables from the First Schedule are currently
 * unverified and left as MANUAL_REVIEW until verified from official sources.
 */

/**
 * Evaluates physical quantity against declared quantity using MPE logic.
 * @param {Object} params
 * @param {string|Object} params.declaredQuantity - The declared quantity on the package.
 * @param {string|Object|null} params.observedQuantity - The actual physical measurement.
 * @param {Object} params.ruleReference - Provenance reference for the First Schedule.
 * @returns {Object} Structured MPE result
 */
export function evaluateMPE({ declaredQuantity, observedQuantity, ruleReference }) {
  // If we lack physical measurement, it's immediately REVIEW.
  // We cannot assess actual net quantity from OCR.
  if (!observedQuantity || observedQuantity === 'NOT_AVAILABLE') {
    return {
      applicable: true,
      status: COMPLIANCE_STATUS.REVIEW,
      declaredQuantity: declaredQuantity || null,
      observedQuantity: null,
      error: null,
      permissibleError: null,
      ruleReference: ruleReference || null,
      evidence: [
        {
          type: 'MISSING_MEASUREMENT',
          field: 'observedQuantity',
          status: 'UNKNOWN',
          reason: 'No calibrated physical quantity measurement supplied. An OCR declaration is evidence of what is printed on the package; it is not evidence of the actual physical quantity contained in the package.'
        }
      ]
    }
  }

  // Parse declared quantity
  const declaredStr = typeof declaredQuantity === 'string' ? declaredQuantity : declaredQuantity?.value
  const normalizedDeclared = normalizeNetQuantity(declaredStr)
  const declaredValid = validateQuantity(normalizedDeclared)

  // Parse observed quantity
  const observedStr = typeof observedQuantity === 'string' ? observedQuantity : observedQuantity?.value
  const normalizedObserved = normalizeNetQuantity(observedStr)
  const observedValid = validateQuantity(normalizedObserved)

  if (!declaredValid.valid || !observedValid.valid) {
    return {
      applicable: true,
      status: COMPLIANCE_STATUS.FAIL,
      declaredQuantity: normalizedDeclared,
      observedQuantity: normalizedObserved,
      error: null,
      permissibleError: null,
      ruleReference: ruleReference || null,
      evidence: [
        {
          type: 'INVALID_QUANTITY_FORMAT',
          field: !declaredValid.valid ? 'declaredQuantity' : 'observedQuantity',
          status: 'FAIL',
          reason: `Invalid or unparseable quantity: ${!declaredValid.valid ? declaredValid.reason : observedValid.reason}`
        }
      ]
    }
  }

  if (normalizedDeclared.quantityKind !== normalizedObserved.quantityKind) {
    return {
      applicable: true,
      status: COMPLIANCE_STATUS.FAIL,
      declaredQuantity: normalizedDeclared,
      observedQuantity: normalizedObserved,
      error: null,
      permissibleError: null,
      ruleReference: ruleReference || null,
      evidence: [
        {
          type: 'QUANTITY_KIND_MISMATCH',
          field: 'observedQuantity',
          status: 'FAIL',
          reason: `Declared kind (${normalizedDeclared.quantityKind}) does not match observed kind (${normalizedObserved.quantityKind})`
        }
      ]
    }
  }

  // Calculate actual error
  const actualErrorBase = normalizedObserved.baseValue - normalizedDeclared.baseValue

  // We do not invent First Schedule numerical bounds. 
  // Because they are not officially verified in the project, we return REVIEW.
  return {
    applicable: true,
    status: COMPLIANCE_STATUS.REVIEW,
    declaredQuantity: normalizedDeclared,
    observedQuantity: normalizedObserved,
    error: {
      value: actualErrorBase,
      unit: normalizedDeclared.baseUnit
    },
    permissibleError: {
      value: null,
      unit: normalizedDeclared.baseUnit,
      reason: 'First Schedule exact MPE values are currently unverified; awaiting official verification.'
    },
    ruleReference: ruleReference || null,
    evidence: [
      {
        type: 'UNVERIFIED_MPE_TOLERANCE',
        field: 'permissibleError',
        status: 'REVIEW',
        reason: 'Physical quantity compliance requires an appropriate measurement procedure/instrument and exact Schedule 1 tolerances.'
      }
    ]
  }
}
