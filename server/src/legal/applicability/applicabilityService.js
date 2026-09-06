// Deterministic applicability service for the LMPC rules.
//
// The service maps a productContext onto rules. It NEVER assumes applicability
// from missing context: when required context is absent the result is REVIEW.

import {
  APPLICABILITY_STATUS,
  CONSUMER_TYPE_VALUES,
  IMPORT_STATUS_VALUES,
  PACKAGE_TYPE_VALUES,
  LEGAL_DOMAIN_VALUES,
  createLegalSource
} from '../compliance/complianceTypes.js'

const { APPLICABLE, NOT_APPLICABLE, REVIEW } = APPLICABILITY_STATUS

export function normalizeProductContext(productContext = {}) {
  const quantityValue = productContext.quantityValue ?? productContext.packageQuantity ?? null
  const quantityUnit = productContext.quantityUnit || productContext.packageUnit || null
  const asOfDate = productContext.asOfDate || productContext.date || new Date()
  
  return {
    ...productContext,
    consumerType: productContext.consumerType || 'UNKNOWN',
    packageType: productContext.packageType || 'UNKNOWN',
    importStatus: productContext.importStatus || 'UNKNOWN',
    domain: productContext.domain || productContext.category || 'UNKNOWN',
    quantityKind: productContext.quantityKind || 'UNKNOWN',
    quantityValue,
    quantityUnit,
    asOfDate,
    
    // Backward compatibility for old tests/services
    packageQuantity: quantityValue,
    packageUnit: quantityUnit,
    date: asOfDate,
  }
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && value !== 'UNKNOWN'
}

export function evaluateApplicability(productContext = {}) {
  const context = normalizeProductContext(productContext)
  const missingContext = []
  
  if (!hasValue(context.consumerType)) missingContext.push('consumerType')
  if (context.quantityValue === null && context.quantityUnit === null) missingContext.push('packageQuantity')

  if (context.consumerType === 'UNKNOWN') {
    return {
      status: REVIEW,
      reason: 'Consumer type (retail vs industrial/institutional) is missing; cannot determine Chapter II scope.',
      scope: { chapterII: null },
      context,
      missingContext,
      importStatus: context.importStatus
    }
  }

  if (context.consumerType === 'INDUSTRIAL' || context.consumerType === 'INSTITUTIONAL') {
    return {
      status: NOT_APPLICABLE,
      reason: 'Consumer type is industrial/institutional and this packaged-commodity requirement is out of scope.',
      scope: { chapterII: false },
      context,
      missingContext: [],
      importStatus: context.importStatus
    }
  }

  if (context.consumerType === 'RETAIL') {
    return {
      status: APPLICABLE,
      reason: 'Retail package within Chapter II mandatory-declaration scope.',
      scope: { chapterII: true },
      context,
      missingContext: [],
      importStatus: context.importStatus
    }
  }

  return {
    status: REVIEW,
    reason: 'Cannot determine Chapter II scope due to unrecognized consumer type.',
    scope: { chapterII: null },
    context,
    missingContext,
    importStatus: context.importStatus
  }
}

function missingFor(ruleCtx, context) {
  const missing = []
  if (Array.isArray(ruleCtx.importStatuses) && !hasValue(context.importStatus)) {
    missing.push('importStatus')
  }
  if ((Array.isArray(ruleCtx.consumerTypes) || Array.isArray(ruleCtx.exemptConsumerTypes)) && !hasValue(context.consumerType)) {
    missing.push('consumerType')
  }
  if (Array.isArray(ruleCtx.packageTypes) && !hasValue(context.packageType)) {
    missing.push('packageType')
  }
  if (Array.isArray(ruleCtx.domains) && !hasValue(context.domain)) {
    missing.push('domain')
  }
  if (ruleCtx.quantityRange && (context.quantityValue === null || context.quantityUnit === null)) {
    missing.push('packageQuantity')
  }
  return missing
}

// Generic deterministic rule-level applicability.
// Returns { ruleId, status, reason, context, source, missing }
export function isRuleApplicable(rule, productContext = {}) {
  if (!rule || typeof rule !== 'object') {
    throw new Error('isRuleApplicable requires a rule object')
  }
  const context = normalizeProductContext(productContext)
  const ruleCtx = rule.applicability || {}
  const source = createLegalSource(rule)
  const missing = missingFor(ruleCtx, context)

  // Gating check: does Chapter II apply?
  const scopeCheck = evaluateApplicability(productContext)
  if (scopeCheck.status !== APPLICABLE) {
    return {
      ruleId: rule.ruleId,
      status: scopeCheck.status,
      reason: scopeCheck.reason,
      context,
      source,
      missing
    }
  }

  // Import Status
  if (Array.isArray(ruleCtx.importStatuses)) {
    if (context.importStatus === 'UNKNOWN') {
      return {
        ruleId: rule.ruleId,
        status: REVIEW,
        reason: 'Import status is unknown and applicability depends on imported status.',
        context,
        source,
        missing
      }
    }
    if (!ruleCtx.importStatuses.includes(context.importStatus)) {
      return {
        ruleId: rule.ruleId,
        status: NOT_APPLICABLE,
        reason: `Import status '${context.importStatus}' not within scope (${ruleCtx.importStatuses.join(', ')}).`,
        context,
        source,
        missing
      }
    }
  }

  // Specific Consumer Type Exemptions/Inclusions
  if (Array.isArray(ruleCtx.consumerTypes)) {
    if (!hasValue(context.consumerType)) {
      return {
        ruleId: rule.ruleId,
        status: REVIEW,
        reason: 'Consumer type is unknown and applicability depends on consumer type.',
        context,
        source,
        missing
      }
    }
    if (!ruleCtx.consumerTypes.includes(context.consumerType)) {
      return {
        ruleId: rule.ruleId,
        status: NOT_APPLICABLE,
        reason: `Consumer type '${context.consumerType}' not within scope.`,
        context,
        source,
        missing
      }
    }
  }

  if (Array.isArray(ruleCtx.exemptConsumerTypes)) {
    if (hasValue(context.consumerType) && ruleCtx.exemptConsumerTypes.includes(context.consumerType)) {
      return {
        ruleId: rule.ruleId,
        status: NOT_APPLICABLE,
        reason: `Consumer type '${context.consumerType}' is exempt from this rule's scope.`,
        context,
        source,
        missing
      }
    }
  }

  // Package Types
  if (Array.isArray(ruleCtx.packageTypes)) {
    if (!hasValue(context.packageType)) {
      return {
        ruleId: rule.ruleId,
        status: REVIEW,
        reason: 'Package type is unknown and applicability depends on package type.',
        context,
        source,
        missing
      }
    }
    if (!ruleCtx.packageTypes.includes(context.packageType)) {
      return {
        ruleId: rule.ruleId,
        status: NOT_APPLICABLE,
        reason: `Package type '${context.packageType}' not within scope.`,
        context,
        source,
        missing
      }
    }
  }

  if (ruleCtx.kind === 'CONTEXT_REQUIRED' && Array.isArray(ruleCtx.contextFields)) {
    const missingFields = ruleCtx.contextFields.filter(f => !hasValue(context[f]))
    if (missingFields.length > 0) {
      if (missingFields.includes('unitSalePriceApplicable') && 
          ['COMBINATION', 'GROUP', 'MULTI_PIECE'].includes(context.packageType)) {
        return {
          ruleId: rule.ruleId,
          status: REVIEW,
          reason: `Package type is ${context.packageType} and the applicable unit-sale-price treatment has not been fully reconciled.`,
          context,
          source,
          missing
        }
      }
      return {
        ruleId: rule.ruleId,
        status: REVIEW,
        reason: `Missing applicability context (${missingFields.join(', ')}) - cannot determine applicability.`,
        context,
        source,
        missing
      }
    }
  }

  // Domains
  if (Array.isArray(ruleCtx.domains)) {
    if (!hasValue(context.domain)) {
      return {
        ruleId: rule.ruleId,
        status: REVIEW,
        reason: 'Domain/category is unknown and applicability depends on domain.',
        context,
        source,
        missing
      }
    }
    if (!ruleCtx.domains.includes(context.domain)) {
      return {
        ruleId: rule.ruleId,
        status: NOT_APPLICABLE,
        reason: `Domain/category '${context.domain}' not within scope.`,
        context,
        source,
        missing
      }
    }
  }

  // Quantity Ranges
  if (ruleCtx.quantityRange) {
    if (context.quantityValue === null || context.quantityUnit === null) {
      return {
        ruleId: rule.ruleId,
        status: REVIEW,
        reason: 'Quantity threshold could not be evaluated because the quantity unit or value is unknown.',
        context,
        source,
        missing
      }
    }
    const { min, max, unit } = ruleCtx.quantityRange
    const qty = Number(context.quantityValue)
    if (Number.isFinite(qty)) {
      if (unit && context.quantityUnit !== unit) {
        return {
          ruleId: rule.ruleId,
          status: REVIEW,
          reason: `Package unit '${context.quantityUnit}' cannot be compared deterministically against required unit '${unit}'.`,
          context,
          source,
          missing
        }
      }
      if (min !== undefined && qty < min) {
        return {
          ruleId: rule.ruleId,
          status: NOT_APPLICABLE,
          reason: `Quantity ${qty} ${context.quantityUnit} is below the stated scope minimum (${min}).`,
          context,
          source,
          missing
        }
      }
      if (max !== undefined && qty > max) {
        return {
          ruleId: rule.ruleId,
          status: NOT_APPLICABLE,
          reason: `Quantity ${qty} ${context.quantityUnit} is above the stated scope maximum (${max}).`,
          context,
          source,
          missing
        }
      }
    }
  }

  return {
    ruleId: rule.ruleId,
    status: APPLICABLE,
    reason: 'Applicable: all rule applicability conditions are satisfied by the provided context.',
    context,
    source,
    missing
  }
}

export const LEGAL_SCOPE_ENUMS = Object.freeze({
  CONSUMER_TYPE_VALUES,
  IMPORT_STATUS_VALUES,
  PACKAGE_TYPE_VALUES,
  LEGAL_DOMAIN_VALUES,
})