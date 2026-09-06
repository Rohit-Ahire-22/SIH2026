// Deterministic unit-sale-price unit-basis computation.
//
// The expected unit-sale-price basis is derived from net quantity using the
// officially-verified framework (legal basis units):
//   mass   below 1 kg  -> per gram
//   mass   above 1 kg  -> per kilogram
//   length below 1 m   -> per centimetre
//   length above 1 m   -> per metre
//   volume below 1 L   -> per millilitre
//   volume above 1 L   -> per litre
//   number-based       -> per number/unit
//
// CONSERVATISM RULES (legal defensibility):
// - The exact boundary case (exactly 1 kg / 1 L / 1 m) is NOT encoded because
//   the official text has not been reconciled for it -> REVIEW with a TODO.
// - COMBINATION / GROUP / MULTI_PIECE packages have verified special
//   unit-sale-price handling; the precise clause is not yet reconciled ->
//   REVIEW with a TODO referencing the official amendment.
// - This service NEVER compares prices against external market data.
// - It computes only the unit basis (what "per X" should be).

import { APPLICABILITY_STATUS } from '../compliance/complianceTypes.js'

const { APPLICABLE, REVIEW } = APPLICABILITY_STATUS

const MASS_UNITS = {
  g: 0.001,
  gm: 0.001,
  gram: 0.001,
  gramme: 0.001,
  gms: 0.001,
  grams: 0.001,
  kg: 1,
  kgs: 1,
  kilogram: 1,
  kilograms: 1,
  mg: 0.000001,
  milligram: 0.000001,
  milligrams: 0.000001,
}

const VOLUME_UNITS = {
  ml: 0.001,
  mL: 0.001,
  millilitre: 0.001,
  milliliter: 0.001,
  millilitres: 0.001,
  l: 1,
  L: 1,
  litre: 1,
  liter: 1,
  litres: 1,
  liters: 1,
}

const LENGTH_UNITS = {
  cm: 0.01,
  centimetre: 0.01,
  centimeter: 0.01,
  centimetres: 0.01,
  m: 1,
  metre: 1,
  meter: 1,
  metres: 1,
  mm: 0.001,
  millimetre: 0.001,
  millimeter: 0.001,
  millimetres: 0.001,
}

const COUNT_UNITS = {
  unit: 1,
  units: 1,
  piece: 1,
  pieces: 1,
  pcs: 1,
  no: 1,
  nos: 1,
  number: 1,
  each: 1,
  count: 1,
}

const COMBINATION_RULE = `COMBINATION / GROUP / MULTI_PIECE packages have verified special unit-sale-price handling under the officially-notified amendment; exact clause reconciliation is required before encoding boundary behaviour.`

export function classifyQuantityKind(unit) {
  const key = unit === null || unit === undefined ? '' : String(unit).trim().toLowerCase()
  if (key in MASS_UNITS) return 'mass'
  if (key in VOLUME_UNITS) return 'volume'
  if (key in LENGTH_UNITS) return 'length'
  if (key in COUNT_UNITS) return 'count'
  return 'UNKNOWN'
}

function reviewResult(reason, todos = []) {
  return { status: REVIEW, reason, todos: [...todos] }
}

function round(value) {
  if (Math.abs(value) >= 1000) return Math.round(value)
  return Math.round(value * 1000000) / 1000000
}

// Computes the deterministic expected unit basis.
// Returns { status, basisUnit, basisQuantity, kind, reason, todos }
// or REVIEW for anything not safely encodable.
export function computeUnitSalePriceBasis({ netQuantity, packageType } = {}) {
  if (
    !netQuantity ||
    netQuantity.value === null ||
    netQuantity.value === undefined ||
    !Number.isFinite(Number(netQuantity.value)) ||
    Number(netQuantity.value) <= 0
  ) {
    return reviewResult('Net quantity is missing or invalid; unit-sale-price basis cannot be computed.')
  }
  if (!netQuantity.unit || classifyQuantityKind(netQuantity.unit) === 'UNKNOWN') {
    return reviewResult(
      `Net quantity unit '${netQuantity.unit}' is not a recognized mass/volume/length/count unit; unit-sale-price basis cannot be computed.`,
    )
  }

  if (['COMBINATION', 'GROUP', 'MULTI_PIECE'].includes(packageType)) {
    return reviewResult(COMBINATION_RULE, [COMBINATION_RULE])
  }

  const unit = String(netQuantity.unit).trim().toLowerCase()
  const value = Number(netQuantity.value)
  const kind = classifyQuantityKind(unit)

  let base // value in the kind's base unit (kg, m, L, count)
  if (kind === 'mass') {
    base = value * MASS_UNITS[unit]
    if (base < 1) {
      return {
        status: APPLICABLE,
        kind,
        basisUnit: 'gram',
        basisQuantity: round(base * 1000),
        reason: `${value} ${netQuantity.unit} is below 1 kg; expected unit-sale-price basis is per gram (${round(base * 1000)} g).`,
        todos: [],
      }
    }
    if (base > 1) {
      return {
        status: APPLICABLE,
        kind,
        basisUnit: 'kilogram',
        basisQuantity: round(base),
        reason: `${value} ${netQuantity.unit} is above 1 kg; expected unit-sale-price basis is per kilogram (${round(base)} kg).`,
        todos: [],
      }
    }
  }

  if (kind === 'volume') {
    base = value * VOLUME_UNITS[unit]
    if (base < 1) {
      return {
        status: APPLICABLE,
        kind,
        basisUnit: 'millilitre',
        basisQuantity: round(base * 1000),
        reason: `${value} ${netQuantity.unit} is below 1 L; expected unit-sale-price basis is per millilitre (${round(base * 1000)} ml).`,
        todos: [],
      }
    }
    if (base > 1) {
      return {
        status: APPLICABLE,
        kind,
        basisUnit: 'litre',
        basisQuantity: round(base),
        reason: `${value} ${netQuantity.unit} is above 1 L; expected unit-sale-price basis is per litre (${round(base)} L).`,
        todos: [],
      }
    }
  }

  if (kind === 'length') {
    base = value * LENGTH_UNITS[unit]
    if (base < 1) {
      return {
        status: APPLICABLE,
        kind,
        basisUnit: 'centimetre',
        basisQuantity: round(base * 100),
        reason: `${value} ${netQuantity.unit} is below 1 m; expected unit-sale-price basis is per centimetre (${round(base * 100)} cm).`,
        todos: [],
      }
    }
    if (base > 1) {
      return {
        status: APPLICABLE,
        kind,
        basisUnit: 'metre',
        basisQuantity: round(base),
        reason: `${value} ${netQuantity.unit} is above 1 m; expected unit-sale-price basis is per metre (${round(base)} m).`,
        todos: [],
      }
    }
  }

  if (kind === 'count') {
    return {
      status: APPLICABLE,
      kind,
      basisUnit: 'unit',
      basisQuantity: round(value),
      reason: `${value} ${netQuantity.unit} number-based commodity; expected unit-sale-price basis is per unit/number.`,
      todos: [],
    }
  }

  // Exactly at the 1-unit boundary (or an unreached fallthrough).
  return reviewResult(
    `Quantity ${value} ${netQuantity.unit} sits exactly on the 1-unit boundary (1 kg / 1 L / 1 m); the official unit-sale-price framework has not been reconciled for this boundary, so it is left to REVIEW.`,
    [
      'Reconcile exact boundary behaviour (exactly 1 kg / 1 L / 1 m) against the officially-notified unit-sale-price amendment before encoding.',
    ],
  )
}

export function describeUnitSalePriceBasis(result) {
  if (result.status === APPLICABLE) {
    return `Expected unit-sale-price basis: per ${result.basisUnit} (${result.basisQuantity}).`
  }
  return result.reason
}