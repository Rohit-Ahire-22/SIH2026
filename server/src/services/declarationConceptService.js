import { COMPLIANCE_STATUS } from '../legal/compliance/complianceTypes.js'

/**
 * declarationConceptService.js
 *
 * Generalized declaration-concept detection layer for packaged-commodity
 * compliance (Legal Metrology (Packaged Commodities) Rules, 2011).
 *
 * Purpose
 * -------
 * A packaged product does NOT always write the field name next to the value.
 * e.g. the package may show only "₹120" (implicit MRP) or "100 g" (implicit
 * net quantity) without an explicit label.  This service turns raw OCR
 * detections ("nodes") into structured, provenance-bearing declarations.
 *
 * Design rules (see SIH 26034 Stage 7.x requirements):
 *  1. GENERIC: concepts are detected through multiple signal channels; there
 *     are N O product/brand-specific rules, no hardcoded brand names.
 *  2. CONSERVATIVE: implicit inference requires a combination of compatible
 *     signals. A lone number is NEVER an MRP; a lone number+unit is NEVER
 *     automatically net quantity; a lone date is NEVER automatically MFD.
 *  3. EXPLICIT vs IMPLICIT: every result records sourceType so downstream
 *     consumers can distinguish "we saw the label" from "we inferred meaning".
 *  4. REVIEW is the fallback: weak or competing evidence -> REVIEW; statuses
 *     are drawn from the compliance contract COMPLIANCE_STATUS.
 *
 * Concept registry
 * ----------------
 * Each concept defines:
 *   - explicit signals      (declaration labels / synonymous phrases)
 *   - value pattern         (regex that recognises the value inside label text)
 *   - implicit pattern      (regex that recognises the value when label is absent)
 *   - rejection patterns    (patterns that must NOT be the value, e.g. phone)
 *   - signal weightings     for implicit-confidence scoring
 *   - value classifier      (parse the captured value into {value, ...} and
 *                            decide whether it is a plausible legal value)
 */

// ---------------------------------------------------------------------------
// Source types (compliance-contract vocabulary)
// ---------------------------------------------------------------------------

export const SOURCE_TYPE = Object.freeze({
  EXPLICIT_LABEL: 'EXPLICIT_LABEL',
  IMPLICIT_CONTEXT: 'IMPLICIT_CONTEXT',
  SPATIAL_ASSOCIATION: 'SPATIAL_ASSOCIATION',
  VISUAL: 'VISUAL',
  MEASUREMENT: 'MEASUREMENT',
  FUSED: 'FUSED',
})

// ---------------------------------------------------------------------------
// Rejection vocabulary used to protect against false positives
// ---------------------------------------------------------------------------

// Phone numbers (Indian formats incl. +91 and 1800-)
export const PHONE_PATTERNS = [
  /(?:\+?91[\s.-]?)?(?:1800[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4}){1,2}|\d{4}[\s.-]?\d{3}[\s.-]?\d{3}|\d{10})\b/,
]

// PIN codes (Indian 6-digit)
export const PIN_PATTERNS = [
  /\b\d{6}\b/,
]

// Batch / Lot / serial identifiers
export const BATCH_PATTERNS = [
  /(?:batch|lot|bt|lt)\s*[.:#\-]?\s*[A-Za-z0-9]{2,}/i,
]

// Dates (any plausible date-like token)
export const DATE_PATTERNS = [
  /(?:\d{1,2})[\s/.-](?:\d{1,2}|[A-Za-z]{3})[\s/.-](?:\d{2,4})/,
  /(?:[A-Za-z]{3})[\s/.-](?:\d{2,4})/,
  /(?:\d{1,2})[\s/.-](?:\d{2,4})/,
]

/**
 * A list of identifier patterns that, if a candidate value matches, strongly
 * suggest the candidate is NOT a legal declaration value (phone, pin, barcode,
 * dimensions, dosage, etc).  Used by implicit inference to reject candidates
 * before any confidence is awarded.
 */
export const REJECTION_PATTERNS = Object.freeze([
  { concept: 'phone', pattern: /(?:\+?91[\s.-]?)?(?:1800[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4}){1,2}|\d{4}[\s.-]?\d{3}[\s.-]?\d{3}|\d{10})\b/ },
  { concept: 'pin', pattern: /(?:^|\D)\d{6}(?:\D|$)/ },
  { concept: 'barcode', pattern: /(?:^|\D)\d{8,14}(?:\D|$)/ },
  { concept: 'date', pattern: /(?:\d{1,2})[\s/.\-](?:\d{1,2}|[A-Za-z]{3})[\s/.\-](?:\d{4})|(?:[A-Za-z]{3})\s*(?:\d{4})/ },
  { concept: 'dimension', pattern: /(?:^|\s)\d+(?:\.\d+)?\s*(?:cm|mm|in|inch|ft|'|''|x\s*\d)\b/i },
  { concept: 'ingredient_qty', pattern: /(?:^|\s)\d+(?:\.\d+)?\s*(?:mg|mcg|mcg|iu|kcal|grams?)\b/i },
  { concept: 'percentage', pattern: /(?:^|\s)\d+(?:\.\d+)?\s*%(?:\s|$)/ },
  { concept: 'batch', pattern: /(?:batch|lot)\s*[.:#\-]?\s*[A-Za-z0-9]{2,}/i },
  { concept: 'serial', pattern: /(?:ser(?:ial)?\s*no|s\/?n|sl\.?no)\s*[.:#\-]?\s*[A-Za-z0-9]{2,}/i },
])

/**
 * Dedicated competing-field LABEL patterns: used ONLY when the candidate token
 * is a bare number/alphanumeric (no self-identifying format). If a nearby
 * declaration clearly labels a competing field, the value is rejected rather
 * than being misread as MRP/quantity/date.
 */
export const COMPETING_FIELD_LABELS = Object.freeze([
  /batch\s*(?:no\.?|number)?\s*/i,
  /lot\s*(?:no\.?|number)?\s*/i,
  /serial\s*(?:no\.?|number)?\s*/i,
  /s\/?n\b/i,
  /pin\s*(?:code)?\s*/i,
  /p\.?\s*o\.?\s*(?:box|no|number)\s*/i,
  /ingredients?\s*[:.\-]/i,
  /nutrition\s*(?:facts|information|values?)\s*[:.\-]/i,
  /dosage\s*[:.\-]/i,
  /customer\s+care\s*[:.\-]/i,
  /helpline\s*[:.\-]/i,
])

// ---------------------------------------------------------------------------
// Unit vocabulary (generalized; extensible)
// ---------------------------------------------------------------------------

export const QUANTITY_UNITS = Object.freeze({
  MASS: {
    g: 1, gm: 1, gram: 1, grams: 1, gms: 1, gramme: 1, grammes: 1, kg: 1000, kilogram: 1000, kilograms: 1000, kgs: 1000, mg: 0.001, milligram: 0.001, milligrams: 0.001, mgs: 0.001, tonne: 1000000, t: 1000000,
  },
  VOLUME: {
    ml: 1, mL: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1, mls: 1, l: 1000, L: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000, cl: 10, cL: 10, centilitre: 10,
  },
  LENGTH: { cm: 1, centimetre: 1, centimeter: 1, mm: 0.1, millimetre: 0.1, millimeter: 0.1, m: 100, metre: 100, meter: 100, km: 100000, inch: 2.54, in: 2.54, ft: 30.48, foot: 30.48 },
  NUMBER: { pc: 1, pcs: 1, piece: 1, pieces: 1, unit: 1, units: 1, no: 1, nos: 1, number: 1, numbers: 1, count: 1, each: 1, u: 1 },
})

export const UNIT_PATTERN = /(?:g|gm|gms|gram|grams|gramme|grammes|kg|kgs|kilogram|kilograms|mg|milligram|milligrams|mgs|tonne|t|ml|mL|millilitre|millilitres|milliliter|milliliters|mls|l|L|litre|litres|liter|liters|cl|cL|centilitre|cm|centimetre|centimeter|mm|millimetre|millimeter|m|metre|meter|km|inch|in|ft|foot|pc|pcs|piece|pieces|unit|units|no|nos|number|numbers|count|each|u)\b/i

/**
 * Normalizes a raw unit string into { kind, canonicalUnit, multiplierToBase }.
 */
export function normalizeQuantityUnit(rawUnit) {
  if (!rawUnit) return null
  const u = String(rawUnit).trim().toLowerCase()
  for (const [kind, table] of Object.entries(QUANTITY_UNITS)) {
    if (u in table) return { kind, canonicalUnit: u === 'l' || u === 'm' ? (kind === 'VOLUME' ? 'L' : 'm') : u, multiplier: table[u] }
  }
  return null
}

// ---------------------------------------------------------------------------
// Value classifiers
// ---------------------------------------------------------------------------

/**
 * Classifies a candidate string as a plausible MRP value.
 * Returns { ok, parsed: { value, currency, inclusiveOfTaxes } } or { ok:false }.
 */
// The rupee slash-notation ("129/-") REQUIRES a slash immediately followed by a
// dash.  A bare "/" (as in date fragments "07/25" or ratio "0.61/ml") is NOT the
// Indian money delimiter, so a lone separator must never read a number as MRP.
export function classifyMrpValue(raw, contextText) {
  if (!raw) return { ok: false }
  const cleaned = String(raw).trim()
  // Currency prefix/suffix detection
  const currencySymbol = /(?:₹|rs\.?|inr|INR)\s*/i.test(cleaned)
  const slashNotation = /(?:^|\s)\d[\d,.]*\s*\/\s*-|\bMRP\b|\bMAX\b|\bMAX\.?\s*RP\b/i.test(cleaned)
  const amountMatch = /(?:₹\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(?:rs\.?\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*\/\s*-)/i.exec(cleaned)
  if (!amountMatch) return { ok: false }
  const amountStr = amountMatch[1] || amountMatch[2] || amountMatch[3] || ''
  const value = parseFloat(amountStr.replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) return { ok: false }
  // Tax-inclusive signal (nearby text or the raw itself)
  const inclusive = /incl(?:usive|\.)?(?:\s*of)?\s+all\s+taxes|including\s+all\s+taxes/i.test(contextText || '')
  return { ok: true, parsed: { value, currency: 'INR', inclusiveOfTaxes: inclusive } }
}

/**
 * Classifies a candidate string as a plausible net quantity value.
 * Returns { ok, parsed: { value, unit, kind, canonicalUnit } } or { ok:false }.
 */
export function classifyQuantityValue(raw) {
  if (!raw) return { ok: false }
  const cleaned = String(raw).trim()
  const match = /(\d+(?:\.\d+)?)\s*([A-Za-z]{1,12})/.exec(cleaned)
  if (!match) return { ok: false }
  const value = parseFloat(match[1])
  const unitInfo = normalizeQuantityUnit(match[2])
  if (!unitInfo || !Number.isFinite(value) || value <= 0) return { ok: false }
  return { ok: true, parsed: { value, unit: unitInfo.canonicalUnit, kind: unitInfo.kind, multiplier: unitInfo.multiplier } }
}

const MONTH_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

/**
 * Classifies a candidate string as a plausible date.
 * Returns { ok, parsed: { iso, original, granularity } } or { ok:false }.
 */
export function classifyDateValue(raw) {
  if (!raw) return { ok: false }
  const cleaned = String(raw).trim()
  const dmy = cleaned.match(/(?<!\d)(0?[1-9]|[12]\d|3[01])[\s/.\-](0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4}|\d{2})(?!\d)/)
  if (dmy) {
    let year = Number(dmy[3])
    if (dmy[3].length === 2) year = 2000 + year
    let month = Number(dmy[2])
    if (isNaN(month)) month = MONTH_MAP[dmy[2].toLowerCase().slice(0, 3)]
    const day = Number(dmy[1])
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { ok: true, parsed: { iso, original: cleaned, granularity: 'DAY' } }
    }
  }
  const my = cleaned.match(/(?<!\d)(0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4})(?!\d)/)
  if (my) {
    let month = Number(my[1])
    if (isNaN(month)) month = MONTH_MAP[my[1].toLowerCase().slice(0, 3)]
    const year = Number(my[2])
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12) {
      const iso = `${year}-${String(month).padStart(2, '0')}-01`
      return { ok: true, parsed: { iso, original: cleaned, granularity: 'MONTH' } }
    }
  }
  return { ok: false }
}

// ---------------------------------------------------------------------------
// Concept definitions
// ---------------------------------------------------------------------------

export const CONCEPTS = Object.freeze({

  MRP: {
    key: 'mrp',
    concept: 'MRP',
    label: 'Maximum Retail Price',
    explicitPatterns: [
      /(?:(?:maximum|max)\.?\s+retail\s+price|m\.?\s*r\.?\s*p\.?|retail\s+price)(?=\s*[:.\-=]?)/i,
    ],
    valueInLabelPattern: /(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*[/-]/i,
    implicitPatterns: [
      /(?:₹|rs\.?|inr)\s*\d[\d,]*\.?\d*|\d[\d,]*\.?\d*\s*[/-]/i,
    ],
    nearbyWords: [/max(?:imum)?\s+retail/i, /m\.?\s*r\.?\s*p/i, /retail\s+price/i, /price\b/i],
    rejection: [REJECTION_PATTERNS[0], REJECTION_PATTERNS[1], REJECTION_PATTERNS[3]],
    valueClassifier: classifyMrpValue,
    weight: {
      currencySymbol: 0.4,
      currencyAbbreviation: 0.4,
      slashNotation: 0.3,
      nearbyPriceWord: 0.3,
      declarationRegion: 0.15,
    },
  },

  NET_QUANTITY: {
    key: 'netQuantity',
    concept: 'NET_QUANTITY',
    label: 'Net quantity',
    explicitPatterns: [
      /net\s+(?:quantity|qty|weight|w(?:t)?\.?|vol(?:ume)?|vol\.?|contents?)\s*[:\-.]?/i,
      /(?:quantity|weight|contents?)\s*[:\-.]?\s*(?!of)/i,
    ],
    valueInLabelPattern: /(\d+(?:\.\d+)?)\s*([A-Za-z]{1,12})\b/,
    implicitPatterns: [
      /(?:^|\s)(\d+(?:\.\d+)?)\s*([A-Za-z]{1,12})\b/i,
    ],
    nearbyWords: [/net\s+qty/i, /net\s+weight/i, /net\s+vol/i, /qty\b/i, /net\b/i, /weight\b/i, /volume\b/i, /contents?\b/i],
    rejection: [REJECTION_PATTERNS[0], REJECTION_PATTERNS[3], /(?:cm|mm|in)\b/i],
    valueClassifier: classifyQuantityValue,
    weight: {
      recognizedUnit: 0.35,
      declarationRegion: 0.15,
      nearbyNetWord: 0.25,
      compatibleRange: 0.15,
    },
  },

  MANUFACTURER: {
    key: 'manufacturerName',
    concept: 'MANUFACTURER',
    label: 'Manufacturer / packer / importer',
    explicitPatterns: [
      /manufactur(?:ed|ing)\s+(?:and\s+marketed\s+|&(?:amp;)?\s*marketed\s+|or\s+marketed\s+)?by/i,
      /mfg\.?\s+by/i,
      /marketed\s+by/i,
      /manufacturer\s*[:.-]?/i,
      /packed\s+by/i,
      /pkd\.?\s+by/i,
      /importer\s*[:.-]?/i,
      /imported\s+(?:and|&)\s+marketed\s+by/i,
    ],
    valueInLabelPattern: /(?:by\s*[:.-]?\s*)?([A-Za-z0-9&\s.,\-]+)/i,
    implicitPatterns: [],
    nearbyWords: [/manufactur/i, /mfg\b/i, /packed\s+by/i, /importer\b/i, /marketed\s+by/i],
    rejection: [REJECTION_PATTERNS[0], REJECTION_PATTERNS[1], REJECTION_PATTERNS[3]],
    valueClassifier: null,
    weight: {},
  },

  COUNTRY_OF_ORIGIN: {
    key: 'countryOfOrigin',
    concept: 'COUNTRY_OF_ORIGIN',
    label: 'Country of origin',
    explicitPatterns: [
      /country\s+of\s+origin/i,
      /made\s+in\b/i,
      /manufactur(?:ed|ing)\s+in\b/i,
      /product\s+of\b/i,
      /origin\s*[:.-]?/i,
    ],
    valueInLabelPattern: /([A-Za-z]{3,})(?:\s|$)/,
    implicitPatterns: [],
    nearbyWords: [/country\s+of\s+origin/i, /made\s+in/i, /origin/i],
    rejection: [REJECTION_PATTERNS[0], REJECTION_PATTERNS[1], /(?:pin|p\.?\s*o\.?\.?)\s*\d/i],
    valueClassifier: null,
    weight: {},
  },

  GENERIC_NAME: {
    key: 'commonGenericName',
    concept: 'GENERIC_NAME',
    label: 'Common / generic name',
    explicitPatterns: [
      /common\s+(?:or\s+)?generic\s+name/i,
      /generic\s+name/i,
      /product\s+(?:name|description)/i,
      /commodity\b/i,
    ],
    valueInLabelPattern: /([A-Za-z][A-Za-z\s\-]{2,})(?:\s|$)/,
    implicitPatterns: [],
    nearbyWords: [/generic\s+name/i, /common\s+name/i, /product\s+name/i, /commodity/i],
    rejection: [REJECTION_PATTERNS[0], REJECTION_PATTERNS[1], /^(?:ingredients|nutrition|direction|warnings)\b/i],
    valueClassifier: null,
    weight: {},
  },

  DATE_OF_MANUFACTURE: {
    key: 'dateOfManufacture',
    concept: 'DATE_OF_MANUFACTURE',
    label: 'Date of manufacture',
    explicitPatterns: [
      /date\s+of\s+manufacture/i,
      /mfg(?:\.)?\s*(?:date|dt\b)?/i,
      /mfd(?:\.)?/i,
      /manufactur(?:ed|ing)\s*(?:date|on)?/i,
    ],
    valueInLabelPattern: /(\d{1,2}[\s/.\-](?:\d{1,2}|[A-Za-z]{3})[\s/.\-]\d{2,4}|\d{1,2}[\s/.\-]\d{2,4}|[A-Za-z]{3}[\s/.\-]\d{4})/i,
    implicitPatterns: [
      /(?:\d{1,2})[\s/.\-](?:\d{1,2}|[A-Za-z]{3})[\s/.\-](?:\d{2,4})|(?:[A-Za-z]{3})[\s/.\-](?:\d{4})/i,
    ],
    nearbyWords: [/mfd\b/i, /mfg\b/i, /manufactur/i, /date\s+of\s+manufacture/i, /packed\s+on/i],
    rejection: [REJECTION_PATTERNS[0], /(?:exp|use\s+by|best\s+before)\b/i],
    valueClassifier: classifyDateValue,
    weight: { validDateStructure: 0.3, nearbyManufacturingWord: 0.3, declarationRegion: 0.15, dateRelationship: 0.15 },
  },

  DATE_OF_PACKING: {
    key: 'dateOfPacking',
    concept: 'DATE_OF_PACKING',
    label: 'Date of packing',
    explicitPatterns: [
      /date\s+of\s+packing/i,
      /packed\s+on/i,
      /packing\s+date/i,
      /pkd(?:\.)?/i,
    ],
    valueInLabelPattern: /(\d{1,2}[\s/.\-](?:\d{1,2}|[A-Za-z]{3})[\s/.\-]\d{2,4}|\d{1,2}[\s/.\-]\d{2,4}|[A-Za-z]{3}[\s/.\-]\d{4})/i,
    implicitPatterns: [
      /(?:\d{1,2})[\s/.\-](?:\d{1,2}|[A-Za-z]{3})[\s/.\-](?:\d{2,4})|(?:[A-Za-z]{3})[\s/.\-](?:\d{4})/i,
    ],
    nearbyWords: [/pkd\b/i, /packed\s+on/i, /packing\s+date/i, /date\s+of\s+packing/i, /placed\s+on/i],
    rejection: [REJECTION_PATTERNS[0], /(?:exp|use\s+by|best\s+before)\b/i],
    valueClassifier: classifyDateValue,
    weight: { validDateStructure: 0.3, nearbyPackingWord: 0.3, declarationRegion: 0.15, dateRelationship: 0.15 },
  },

  EXPIRY_USE_BY_BEST_BEFORE: {
    key: 'expiryOrUseByDate',
    concept: 'EXPIRY_USE_BY_BEST_BEFORE',
    label: 'Expiry / Use-by / Best-before',
    explicitPatterns: [
      /(?:expiry|expir[eé])\s*(?:date)?/i,
      /use\s+by(?!\s+date)/i,
      /best\s+before/i,
      /exp(?:\.)?\s*(?:date)?/i,
      /bbe\b/i,
    ],
    valueInLabelPattern: /(\d{1,2}[\s/.\-](?:\d{1,2}|[A-Za-z]{3})[\s/.\-]\d{2,4}|\d{1,2}[\s/.\-]\d{2,4}|[A-Za-z]{3}[\s/.\-]\d{4})/i,
    implicitPatterns: [
      /(?:\d{1,2})[\s/.\-](?:\d{1,2}|[A-Za-z]{3})[\s/.\-](?:\d{2,4})|(?:[A-Za-z]{3})[\s/.\-](?:\d{4})/i,
    ],
    nearbyWords: [/exp(?:iry|\.)?/i, /use\s+by/i, /best\s+before/i, /bb(?:e)?\b/i],
    rejection: [REJECTION_PATTERNS[0], /(?:mfd|mfg|manufactur|packed\s+on|pkd)\b/i],
    valueClassifier: classifyDateValue,
    weight: { validDateStructure: 0.3, nearbyExpiryWord: 0.3, declarationRegion: 0.15, dateRelationship: 0.15 },
  },

  BATCH_LOT: {
    key: 'batchLotNumber',
    concept: 'BATCH_LOT',
    label: 'Batch / Lot',
    explicitPatterns: [
      /(?:batch|lot|l[oO]t)\s*(?:no\.?|number\.?)?\s*[.:#\-]?/i,
      /code\s*[:#]?/i,
    ],
    valueInLabelPattern: /([A-Za-z0-9][A-Za-z0-9./\-]{1,30})/,
    implicitPatterns: [/^[A-Z]{1,3}[0-9]{2,}$/i, /^[0-9]{2,}[A-Z]{1,3}$/i],
    nearbyWords: [/batch\b/i, /lot\b/i, /code\b/i],
    rejection: [REJECTION_PATTERNS[0], /(?:pin|p\.?o)\.?\s*\d/i, REJECTION_PATTERNS[3]],
    valueClassifier: (raw) => (/[A-Za-z0-9]/.test(raw) ? { ok: true, parsed: { value: raw } } : { ok: false }),
    weight: { nearbyBatchWord: 0.4, alphanumericFormat: 0.25, declarationRegion: 0.15 },
  },

  CONSUMER_CARE: {
    key: 'consumerCareDetails',
    concept: 'CONSUMER_CARE',
    label: 'Consumer care / contact',
    explicitPatterns: [
      /consumer\s+care/i,
      /consumer\s+complaint/i,
      /customer\s+care/i,
      /customer\s+service/i,
      /helpline/i,
      /toll[\s-]?free/i,
      /queries\b/i,
      /feedback\b/i,
    ],
    valueInLabelPattern: /([^]*)/, // value handled by classifier below
    implicitPatterns: [],
    nearbyWords: [/care\b/i, /helpline/i, /customer/i, /consumer/i],
    rejection: [REJECTION_PATTERNS[1], REJECTION_PATTERNS[3]],
    valueClassifier: null,
    weight: {},
  },

  UNIT_SALE_PRICE: {
    key: 'unitSalePrice',
    concept: 'UNIT_SALE_PRICE',
    label: 'Unit sale price',
    explicitPatterns: [
      /unit\s+sale\s+price/i,
      /unit\s+price/i,
      /per\s+unit\s+price/i,
    ],
    valueInLabelPattern: /(?:₹|rs\.?|inr)\s*\d[\d,]*\.?\d*|\d[\d,]*\.?\d*\s*[/-]/i,
    implicitPatterns: [],
    nearbyWords: [/unit\s+sale\s+price/i, /rate\b/i, /per\s*(?:kg|g|liter|litre|l|ml)/i],
    rejection: [REJECTION_PATTERNS[0], REJECTION_PATTERNS[1]],
    valueClassifier: classifyMrpValue,
    weight: {},
  },

  DIMENSIONS: {
    key: 'dimensions',
    concept: 'DIMENSIONS',
    label: 'Dimensions',
    explicitPatterns: [
      /dimensions?\s*[:\-.]?/i,
      /dim\s*[:\-.]?/i,
      /size\s*[:\-.]?/i,
    ],
    valueInLabelPattern: /(\d+(?:\.\d+)?\s*(?:cm|mm|m|in|inch)\s*[xX*]\s*\d+(?:\.\d+)?(?:\s*(?:cm|mm|m|in|inch))?)/,
    implicitPatterns: [],
    nearbyWords: [/dimensions?/i, /\bsize\b/i],
    rejection: [REJECTION_PATTERNS[0]],
    valueClassifier: (raw) => { const m = String(raw).match(/(\d+(?:\.\d+)?)\s*(cm|mm|m|in|inch)\s*[xX*]\s*(\d+(?:\.\d+)?)/i); return m ? { ok: true, parsed: { width: m[1], unit: m[2], height: m[3] } } : { ok: false } },
    weight: {},
  },
})

export function getConcept(key) {
  return CONCEPTS[key] || null
}

export function getConceptKeys() {
  return Object.keys(CONCEPTS)
}

// ---------------------------------------------------------------------------
// Geometry helpers (bbox utilities used across the engine)
// ---------------------------------------------------------------------------

export function getBoxCenter(box) {
  if (!box || box.length < 4) return [0, 0]
  return [(box[0][0] + box[2][0]) / 2, (box[0][1] + box[2][1]) / 2]
}

export function getBoxHeight(box) {
  if (!box || box.length < 4) return 10
  return Math.abs(box[2][1] - box[0][1])
}

export function getBoxWidth(box) {
  if (!box || box.length < 4) return 10
  return Math.abs(box[1][0] - box[0][0])
}

export function getFontSize(box) {
  if (!box) return 10
  return Math.max(8, Math.min(getBoxHeight(box), getBoxWidth(box)))
}

export function computeDistance(boxA, boxB) {
  if (!boxA || !boxB) return Infinity
  const [cxA, cyA] = getBoxCenter(boxA)
  const [cxB, cyB] = getBoxCenter(boxB)
  return Math.sqrt(Math.pow(cxA - cxB, 2) + Math.pow(cyA - cyB, 2))
}

export function computeBoundingBox(boxes) {
  const valid = boxes.filter(b => b && Array.isArray(b))
  if (!valid.length) return undefined
  const xs = []
  const ys = []
  for (const box of valid) {
    for (const p of box) {
      if (p && p.length >= 2) { xs.push(p[0]); ys.push(p[1]) }
    }
  }
  if (!xs.length) return undefined
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
}

/**
 * Reconstructs a value token that the OCR split across multiple nodes.
 * Tries left-to-right, right-to-left, and top-to-bottom joins while keeping
 * the geometric relation to the anchor.
 */
export function reconstructToken(nodes, anchorIndex, patterns, maxRadius) {
  const anchor = nodes[anchorIndex]
  if (!anchor) return null
  const anchorSize = getFontSize(anchor.bbox)
  const radius = maxRadius || anchorSize * 6
  const candidates = []

  // same-line traversal (left-right then right-left) plus vertical
  const ordered = nodes
    .map((n, i) => ({ box: n, index: i, dist: computeDistance(anchor.bbox, n.bbox) }))
    .filter(n => n.index !== anchorIndex && n.dist > 0 && n.dist < radius)
    .sort((a, b) => a.dist - b.dist)

  for (const neighbor of ordered) {
    for (const pattern of patterns) {
      const joined1 = `${anchor.text} ${neighbor.box.text}`
      const joined2 = `${neighbor.box.text} ${anchor.text}`
      let m = pattern.exec(joined1)
      if (m) candidates.push({ text: joined1, boxes: [anchor, neighbor.box], dist: neighbor.dist, match: m })
      m = pattern.exec(joined2)
      if (m && !candidates.length) candidates.push({ text: joined2, boxes: [neighbor.box, anchor], dist: neighbor.dist, match: m })
    }
    if (candidates.length) break
  }

  if (candidates.length) return candidates[0]
  return null
}