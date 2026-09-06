export const QUANTITY_KINDS = Object.freeze({
  MASS: 'MASS',
  VOLUME: 'VOLUME',
  LENGTH: 'LENGTH',
  AREA: 'AREA',
  NUMBER: 'NUMBER',
  UNKNOWN: 'UNKNOWN'
})

export const BASE_UNITS = Object.freeze({
  MASS: 'g',
  VOLUME: 'mL',
  LENGTH: 'cm',
  AREA: 'cm2',
  NUMBER: 'unit'
})

// Normalizes common unit abbreviations to a standard representation.
function normalizeUnitString(unitRaw) {
  if (!unitRaw) return ''
  const u = unitRaw.trim().toLowerCase()
  // Mass
  if (u === 'g' || u === 'gm' || u === 'gms' || u === 'gram' || u === 'grams') return 'g'
  if (u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms') return 'kg'
  if (u === 'mg' || u === 'mgs' || u === 'milligram' || u === 'milligrams') return 'mg'
  // Volume
  if (u === 'l' || u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'L'
  if (u === 'ml' || u === 'mls' || u === 'milliliter' || u === 'milliliters' || u === 'millilitre' || u === 'millilitres') return 'mL'
  if (u === 'cl' || u === 'centiliter' || u === 'centilitre') return 'cL'
  // Length
  if (u === 'm' || u === 'meter' || u === 'meters' || u === 'metre' || u === 'metres') return 'm'
  if (u === 'cm' || u === 'centimeter' || u === 'centimeters' || u === 'centimetre' || u === 'centimetres') return 'cm'
  if (u === 'mm' || u === 'millimeter' || u === 'millimeters' || u === 'millimetre' || u === 'millimetres') return 'mm'
  // Area
  if (u === 'cm2' || u === 'sq cm' || u === 'square cm' || u === 'sq. cm') return 'cm2'
  if (u === 'm2' || u === 'sq m' || u === 'square m' || u === 'sq. m') return 'm2'
  // Number
  if (u === 'pc' || u === 'pcs' || u === 'piece' || u === 'pieces' || u === 'u' || u === 'unit' || u === 'units' || u === 'n' || u === 'no' || u === 'nos' || u === 'number' || u === 'numbers') return 'unit'
  return u
}

// Maps a normalized unit to its physical quantity kind and conversion multiplier to base unit.
function getUnitInfo(normalizedUnit) {
  switch (normalizedUnit) {
    // MASS (base: g)
    case 'g': return { kind: QUANTITY_KINDS.MASS, multiplier: 1 }
    case 'kg': return { kind: QUANTITY_KINDS.MASS, multiplier: 1000 }
    case 'mg': return { kind: QUANTITY_KINDS.MASS, multiplier: 0.001 }
    // VOLUME (base: mL)
    case 'mL': return { kind: QUANTITY_KINDS.VOLUME, multiplier: 1 }
    case 'L': return { kind: QUANTITY_KINDS.VOLUME, multiplier: 1000 }
    case 'cL': return { kind: QUANTITY_KINDS.VOLUME, multiplier: 10 }
    // LENGTH (base: cm)
    case 'cm': return { kind: QUANTITY_KINDS.LENGTH, multiplier: 1 }
    case 'm': return { kind: QUANTITY_KINDS.LENGTH, multiplier: 100 }
    case 'mm': return { kind: QUANTITY_KINDS.LENGTH, multiplier: 0.1 }
    // AREA (base: cm2)
    case 'cm2': return { kind: QUANTITY_KINDS.AREA, multiplier: 1 }
    case 'm2': return { kind: QUANTITY_KINDS.AREA, multiplier: 10000 }
    // NUMBER (base: unit)
    case 'unit': return { kind: QUANTITY_KINDS.NUMBER, multiplier: 1 }
    
    default:
      return { kind: QUANTITY_KINDS.UNKNOWN, multiplier: null }
  }
}

/**
 * Parses and normalizes a net quantity string.
 * @param {string} sourceText - the raw OCR or product text, e.g. "500 g"
 * @returns {Object} normalized structured representation.
 */
export function normalizeNetQuantity(sourceText) {
  if (typeof sourceText !== 'string') {
    return _unknownResult(sourceText)
  }

  const text = sourceText.trim()
  if (!text) {
    return _unknownResult(text)
  }

  // Regex to extract numeric value and unit. 
  // e.g. "500 g", "0.5kg", "1.5 L", "10 pcs"
  // Negative numbers should be parsed to fail validation downstream.
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z.2]+(?:[ \.]?[a-zA-Z]+)?)$/)
  
  if (!match) {
    return _unknownResult(text)
  }

  const numericVal = parseFloat(match[1])
  const rawUnit = match[2]

  const normalizedUnit = normalizeUnitString(rawUnit)
  const { kind, multiplier } = getUnitInfo(normalizedUnit)

  let baseValue = null
  let baseUnit = null

  if (kind !== QUANTITY_KINDS.UNKNOWN && !isNaN(numericVal) && multiplier !== null) {
    baseValue = numericVal * multiplier
    baseUnit = BASE_UNITS[kind]
  }

  return {
    value: numericVal,
    unit: normalizedUnit,
    quantityKind: kind,
    baseValue,
    baseUnit,
    sourceText: text
  }
}

/**
 * Validates the normalized quantity structure.
 * @param {Object} normalized - result from normalizeNetQuantity
 * @returns {Object} { valid: boolean, reason: string|null }
 */
export function validateQuantity(normalized) {
  if (normalized.quantityKind === QUANTITY_KINDS.UNKNOWN) {
    return { valid: false, reason: 'UNKNOWN_UNIT' }
  }
  if (typeof normalized.value !== 'number' || isNaN(normalized.value)) {
    return { valid: false, reason: 'INVALID_VALUE' }
  }
  if (!isFinite(normalized.value)) {
    return { valid: false, reason: 'NON_FINITE_VALUE' }
  }
  if (normalized.value <= 0) {
    return { valid: false, reason: 'ZERO_OR_NEGATIVE_VALUE' }
  }
  return { valid: true, reason: null }
}

function _unknownResult(sourceText) {
  return {
    value: null,
    unit: null,
    quantityKind: QUANTITY_KINDS.UNKNOWN,
    baseValue: null,
    baseUnit: null,
    sourceText
  }
}
