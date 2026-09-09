// Deterministic Rule 6 clause-level compliance evaluation.
//
// evaluateRule6 works ONLY on structured product evidence + explicit context.
// It never lets an LLM (or any component) decide legal compliance, never
// fabricates evidence, and never converts missing OCR into FAIL without proof
// the relevant package area was actually inspected.
//
// Evidence philosophy (CRITICAL for legal defensibility):
//   PRESENT           - structured evidence value exists
//   ABSENT_CONFIRMED  - the pipeline explicitly confirmed the declaration is
//                       absent from the inspected package area. This can ONLY
//                       be asserted by the caller via
//                       context.confirmedAbsentFields = ['field', ...].
//                       OCR alone can never produce this.
//   UNKNOWN           - no evidence, no confirmed inspection -> REVIEW.
//
// Context flags (explicit, deterministic, never inferred):
//   context.confirmedAbsentFields  -> fields proven absent by inspection
//   context.expiryRequired         -> true/false: best-before/use-by applies
//   context.dimensionsApplicable   -> true/false: dimension declaration applies
//   context.unitSalePriceApplicable-> true/false: unit-sale-price applies
//   context.consumerType / importStatus / packageType / domain / category
//   context.packageQuantity / packageUnit

import {
  COMPLIANCE_STATUS,
  createComplianceResult,
  createEvidence,
  createLegalSource,
} from '../compliance/complianceTypes.js'
import {
  evaluateApplicability,
  isRuleApplicable,
} from '../applicability/applicabilityService.js'
import { normalizeDate } from '../rules/ruleRegistry.js'
import {
  getRule6ClausesForDate,
} from '../rules/lmpcRule6Clauses.js'
import { computeUnitSalePriceBasis } from './unitSalePriceService.js'

const { PASS, FAIL, REVIEW, NOT_APPLICABLE, PENDING } = COMPLIANCE_STATUS

export const EVIDENCE_STATE = Object.freeze({
  PRESENT: 'PRESENT',
  ABSENT_CONFIRMED: 'ABSENT_CONFIRMED',
  UNKNOWN: 'UNKNOWN',
})

const RULE_6_SOURCE_DOCUMENT =
  'Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)'
const RULE_6_SOURCE_URL = 'https://www.indiacode.nic.in/'

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

function evidenceStateFor(field, product, context) {
  if (isConfirmedAbsent(field, context)) return EVIDENCE_STATE.ABSENT_CONFIRMED
  const raw = readProductField(product, field)
  if (hasValue(raw)) return EVIDENCE_STATE.PRESENT
  return EVIDENCE_STATE.UNKNOWN
}

function isNetQuantityValid(nq) {
  if (!nq) return false
  const value = Number(nq.value)
  if (!Number.isFinite(value) || value <= 0) return false
  return typeof nq.unit === 'string' && nq.unit.trim().length > 0
}

function isMrpValid(mrp) {
  if (typeof mrp === 'string' && mrp.trim() === '') return false
  const value = Number(mrp)
  return Number.isFinite(value) && value > 0
}

function consumerCareValid(cc) {
  if (!cc || typeof cc !== 'object') return false
  return hasValue(cc.phone) || hasValue(cc.email)
}

function statusRank(status) {
  const order = { [FAIL]: 1, [REVIEW]: 2, [PENDING]: 2, [PASS]: 3, [NOT_APPLICABLE]: 4 }
  return order[status] ?? 2
}

function worstStatus(statuses) {
  const executed = statuses.filter((s) => s !== NOT_APPLICABLE)
  if (executed.length === 0) return NOT_APPLICABLE
  return executed.sort((a, b) => statusRank(a) - statusRank(b))[0]
}

function buildSource(clause) {
  return {
    ...createLegalSource({ ruleNumber: '6', ruleId: clause.ruleId }),
    clause: clause.clause,
    effectiveFrom: clause.effectiveFrom ?? null,
    effectiveTo: clause.effectiveTo ?? null,
    sourceDocument: clause.sourceDocument ?? RULE_6_SOURCE_DOCUMENT,
    sourceUrl: clause.sourceUrl ?? RULE_6_SOURCE_URL,
  }
}

function evidenceForPresentFields(clause, product) {
  const evidence = []
  for (const field of clause.evidenceFields) {
    if (field === 'ocrResults' || field === 'ocrText') continue
    const raw = readProductField(product, field)
    if (hasValue(raw)) {
      evidence.push(createEvidence({ field, value: safeString(raw), source: 'ocr' }))
    }
  }
  return evidence
}

function absentEvidenceMarker(clause) {
  return [{ field: clause.key, value: null, source: 'ocr', state: EVIDENCE_STATE.ABSENT_CONFIRMED }]
}

// --- clause evaluators -------------------------------------------------------

function presenceEvaluation(clause, product, context) {
  const state = evidenceStateFor(clause.key, product, context)
  if (state === EVIDENCE_STATE.PRESENT) {
    return { status: PASS, evidence: evidenceForPresentFields(clause, product), reason: `Declaration present in available product evidence.` }
  }
  if (state === EVIDENCE_STATE.ABSENT_CONFIRMED) {
    return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: `Declaration absent and confirmed absent by inspected package evidence (${clause.key}).` }
  }
  return { status: REVIEW, evidence: [], reason: `No ${clause.key} evidence and no confirmed inspection of the relevant package area; cannot establish presence or absence.` }
}

function netQuantityEvaluation(clause, product, context) {
  const nq = readProductField(product, 'netQuantity')
  if (hasValue(nq)) {
    if (isNetQuantityValid(nq)) {
      return {
        status: PASS,
        evidence: [{ field: 'netQuantity', value: { value: nq.value, unit: nq.unit }, source: 'ocr' }],
        reason: 'Net quantity declaration present with valid {value, unit} structure. Physical quantity NOT verified (no MPE/physical measurement at this stage).',
      }
    }
    return {
      status: FAIL,
      evidence: [{ field: 'netQuantity', value: { value: nq.value, unit: nq.unit ?? null }, source: 'ocr' }],
      reason: 'Net quantity declaration present but structurally invalid (value must be a finite positive number with a non-empty unit).',
    }
  }
  if (isConfirmedAbsent('netQuantity', context)) {
    return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: 'Net quantity declaration absent and confirmed absent by inspected package evidence.' }
  }
  return { status: REVIEW, evidence: [], reason: 'No net quantity evidence; insufficient to prove absence. Physical quantity cannot be inferred from a photograph.' }
}

function mrpEvaluation(clause, product, context) {
  const mrp = readProductField(product, 'mrp')
  if (hasValue(mrp)) {
    if (isMrpValid(mrp)) {
      return {
        status: PASS,
        evidence: [{ field: 'mrp', value: Number(mrp), source: 'ocr' }],
        reason: 'MRP (retail sale price) declaration present and structurally valid. No market-price comparison performed.',
      }
    }
    return {
      status: FAIL,
      evidence: [{ field: 'mrp', value: safeString(mrp), source: 'ocr' }],
      reason: 'MRP declaration present but not structurally valid (must be a positive finite amount).',
    }
  }
  if (isConfirmedAbsent('mrp', context)) {
    return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: 'MRP declaration absent and confirmed absent by inspected package evidence.' }
  }
  return { status: REVIEW, evidence: [], reason: 'No MRP evidence; insufficient to prove absence (OCR may have failed).' }
}

function consumerCareEvaluation(clause, product, context) {
  const cc = readProductField(product, 'consumerCareDetails')
  if (consumerCareValid(cc)) {
    return {
      status: PASS,
      evidence: [{ field: 'consumerCareDetails', value: { phone: cc.phone ?? null, email: cc.email ?? null }, source: 'ocr' }],
      reason: 'Consumer-care contact extracted under an explicit consumer-care label. A random OCR phone number was not used as consumer-care evidence.',
    }
  }
  if (isConfirmedAbsent('consumerCareDetails', context)) {
    return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: 'Consumer-care contact absent and confirmed absent by inspected package evidence.' }
  }
  return { status: REVIEW, evidence: [], reason: 'No structured consumer-care contact evidence; cannot establish presence or absence.' }
}

function expiryEvaluation(clause, product, context) {
  const date = readProductField(product, 'expiryOrUseByDate')
  if (hasValue(date)) {
    return {
      status: PASS,
      evidence: [{ field: 'expiryOrUseByDate', value: safeString(date), source: 'ocr' }],
      reason: 'Best-before/use-by declaration present.',
    }
  }
  if (context.expiryRequired === true) {
    if (isConfirmedAbsent('expiryOrUseByDate', context)) {
      return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: 'Best-before/use-by required and confirmed absent by inspected package evidence.' }
    }
    return { status: REVIEW, evidence: [], reason: 'Best-before/use-by applies per supplied context but no evidence found; OCR absence is not proof of absence.' }
  }
  if (context.expiryRequired === false) {
    return { status: NOT_APPLICABLE, evidence: [], reason: 'Best-before/use-by not applicable per supplied commodity context.' }
  }
  return { status: REVIEW, evidence: [], reason: 'Cannot determine from available context whether best-before/use-by applies to this commodity/domain.' }
}

function dimensionsEvaluation(clause, product, context) {
  const dims = readProductField(product, 'dimensions')
  if (hasValue(dims)) {
    return { status: PASS, evidence: [{ field: 'dimensions', value: safeString(dims), source: 'ocr' }], reason: 'Dimensions declaration present.' }
  }
  if (context.dimensionsApplicable === true) {
    if (isConfirmedAbsent('dimensions', context)) {
      return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: 'Dimensions required and confirmed absent by inspected package evidence.' }
    }
    return { status: REVIEW, evidence: [], reason: 'Dimensions apply per supplied context but no evidence found; OCR absence is not proof of absence.' }
  }
  if (context.dimensionsApplicable === false) {
    return { status: NOT_APPLICABLE, evidence: [], reason: 'Dimensions declaration not applicable per supplied commodity context.' }
  }
  return { status: REVIEW, evidence: [], reason: 'Cannot determine from available context whether a dimensions declaration applies.' }
}

function unitSalePriceEvaluation(clause, product, context) {
  const usp = readProductField(product, 'unitSalePrice')
  if (hasValue(usp)) {
    return { status: PASS, evidence: [{ field: 'unitSalePrice', value: Number(usp), source: 'ocr' }], reason: 'Unit sale price declaration present.' }
  }
  if (context.unitSalePriceApplicable === true) {
    if (isConfirmedAbsent('unitSalePrice', context)) {
      return { status: FAIL, evidence: absentEvidenceMarker(clause), reason: 'Unit sale price required and confirmed absent by inspected package evidence.' }
    }
    return { status: REVIEW, evidence: [], reason: 'Unit sale price applies per supplied context but no evidence found; OCR absence is not proof of absence.' }
  }
  if (context.unitSalePriceApplicable === false) {
    return { status: NOT_APPLICABLE, evidence: [], reason: 'Unit sale price not applicable per supplied commodity context.' }
  }
  const basis = computeUnitSalePriceBasis({
    netQuantity: readProductField(product, 'netQuantity'),
    packageType: context.packageType,
  })
  if (basis.status === 'APPLICABLE') {
    return {
      status: REVIEW,
      evidence: [],
      reason: `Unit-sale-price applicability not declared in context; declaration presence not verifiable from current evidence. Expected basis: per ${basis.basisUnit} (${basis.basisQuantity}).`,
    }
  }
  return {
    status: REVIEW,
    evidence: [],
    reason: 'Unit-sale-price applicability not declared in context.' + (basis.reason ? ` ${basis.reason}` : ''),
  }
}

const CLAUSE_EVALUATORS = {
  manufacturerName: presenceEvaluation,
  manufacturerAddress: presenceEvaluation,
  countryOfOrigin: presenceEvaluation,
  commonGenericName: presenceEvaluation,
  netQuantity: netQuantityEvaluation,
  dateOfManufacture: presenceEvaluation,
  dateOfPacking: presenceEvaluation,
  expiryOrUseByDate: expiryEvaluation,
  mrp: mrpEvaluation,
  consumerCareDetails: consumerCareEvaluation,
  dimensions: dimensionsEvaluation,
  unitSalePrice: unitSalePriceEvaluation,
}

// Main entry point.
export function evaluateRule6({ product = {}, context = {}, asOfDate }) {
  const day = normalizeDate(asOfDate)

  // Chapter II scope gate (Rule 3). Not applicable -> whole rule 6 not applicable.
  const scope = evaluateApplicability(context)
  if (scope.status === 'NOT_APPLICABLE') {
    return {
      ruleNumber: '6',
      status: NOT_APPLICABLE,
      asOfDate: day,
      reason: scope.reason,
      source: buildSource({ ruleId: 'LMPC-RULE-6', clause: '6' }),
      checks: [],
    }
  }

  const clauses = getRule6ClausesForDate(day)
  const checks = []

  for (const clause of clauses) {
    const applicability = isRuleApplicable(clause, context)
    if (applicability.status === 'NOT_APPLICABLE') {
      checks.push(
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
      checks.push(
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

    const evaluator = CLAUSE_EVALUATORS[clause.key]
    const outcome =
      typeof evaluator === 'function'
        ? evaluator(clause, product, context)
        : { status: REVIEW, evidence: [], reason: 'No deterministic evaluator registered for this clause yet.' }

    checks.push(
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

  let overall = worstStatus(checks.map((c) => c.status))

  // If the Chapter II scope itself is unresolved, the overall result cannot be
  // better than REVIEW — never claim compliance against unproven applicability.
  if (scope.status === 'REVIEW' && statusRank(overall) > statusRank(REVIEW)) {
    overall = REVIEW
  }

  const applicableCount = checks.filter((c) => c.status !== NOT_APPLICABLE).length
  const reason =
    scope.status === 'REVIEW'
      ? `Chapter II applicability is REVIEW: ${scope.reason}`
      : overall === NOT_APPLICABLE
        ? scope.reason
        : `Rule 6 evaluated on ${day}; ${applicableCount} applicable clause checks.`

  return {
    ruleNumber: '6',
    status: overall,
    asOfDate: day,
    reason,
    source: buildSource({ ruleId: 'LMPC-RULE-6', clause: '6' }),
    checks,
  }
}