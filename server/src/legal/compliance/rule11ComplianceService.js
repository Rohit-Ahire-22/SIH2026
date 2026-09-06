import {
  COMPLIANCE_STATUS,
  createComplianceResult,
  createEvidence,
  createLegalSource,
} from './complianceTypes.js'
import { getRule11ClausesForDate } from '../rules/lmpcRule11Clauses.js'
import { isRuleApplicable } from '../applicability/applicabilityService.js'
import { normalizeNetQuantity, validateQuantity } from './netQuantityService.js'
import { evaluateMPE } from './mpeService.js'

const { PASS, FAIL, REVIEW, NOT_APPLICABLE, PENDING } = COMPLIANCE_STATUS

/**
 * Rule 11 Compliance Service.
 * Evaluates the net quantity declaration and MPE rules.
 */
export async function evaluateRule11(product, context, asOfDate = new Date()) {
  const clauses = getRule11ClausesForDate(asOfDate)
  const results = []

  for (const clause of clauses) {
    const applicability = isRuleApplicable(clause, context)
    
    if (applicability.status === 'NOT_APPLICABLE') {
      results.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: NOT_APPLICABLE,
          reason: applicability.reason,
          source: createLegalSource(clause)
        })
      )
      continue
    }

    if (applicability.status === 'REVIEW') {
      results.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: REVIEW,
          reason: 'Applicability requires manual review due to missing context.',
          source: createLegalSource(clause)
        })
      )
      continue
    }

    // Applicability is APPLICABLE. Evaluate based on clause.
    if (clause.key === 'netQuantityExpression') {
      results.push(evaluateNetQuantityExpression(clause, product, context))
    } else if (clause.key === 'maximumPermissibleError') {
      results.push(evaluateMaximumPermissibleError(clause, product, context))
    } else {
      // Fallback for unknown clause
      results.push(
        createComplianceResult({
          ruleId: clause.ruleId,
          status: REVIEW,
          reason: 'Clause evaluation logic not implemented.',
          source: createLegalSource(clause)
        })
      )
    }
  }

  return results
}

function evaluateNetQuantityExpression(clause, product, context) {
  const netQtyStr = product.netQuantity
  
  if (context.confirmedAbsentFields && context.confirmedAbsentFields.includes('netQuantity')) {
    return createComplianceResult({
      ruleId: clause.ruleId,
      status: FAIL,
      reason: 'Net quantity declaration is explicitly confirmed missing.',
      evidence: [createEvidence({ field: 'netQuantity', value: null, source: 'manual' })],
      source: createLegalSource(clause)
    })
  }

  if (!netQtyStr) {
    return createComplianceResult({
      ruleId: clause.ruleId,
      status: REVIEW,
      reason: 'Net quantity declaration missing from OCR evidence. May be present but undetected.',
      evidence: [createEvidence({ field: 'netQuantity', value: null, source: 'ocr' })],
      source: createLegalSource(clause)
    })
  }

  const normalized = normalizeNetQuantity(netQtyStr)
  const validCheck = validateQuantity(normalized)

  if (!validCheck.valid) {
    return createComplianceResult({
      ruleId: clause.ruleId,
      status: FAIL,
      reason: `Net quantity declaration is invalid or malformed: ${validCheck.reason}`,
      evidence: [
        createEvidence({ field: 'netQuantity', value: netQtyStr, source: 'ocr' })
      ],
      source: createLegalSource(clause)
    })
  }

  return createComplianceResult({
    ruleId: clause.ruleId,
    status: PASS,
    reason: 'Net quantity declaration is present and structurally valid.',
    evidence: [
      createEvidence({ field: 'netQuantity', value: netQtyStr, source: 'ocr' })
    ],
    source: createLegalSource(clause)
  })
}

function evaluateMaximumPermissibleError(clause, product, context) {
  // If the net quantity declaration is missing/absent, MPE logic is automatically REVIEW.
  // We can't check MPE without a declared quantity.
  
  const mpeResult = evaluateMPE({
    declaredQuantity: product.netQuantity,
    observedQuantity: product.observedQuantity || 'NOT_AVAILABLE',
    ruleReference: createLegalSource(clause)
  })

  // Convert the output of mpeService to a compliance result.
  return createComplianceResult({
    ruleId: clause.ruleId,
    status: mpeResult.status,
    reason: mpeResult.status === REVIEW 
      ? mpeResult.evidence[0].reason 
      : 'MPE evaluation completed.',
    evidence: mpeResult.evidence.map(e => createEvidence({ field: e.field, value: e.status, source: e.type })),
    source: createLegalSource(clause)
  })
}
