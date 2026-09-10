import {
  SOURCE_TYPE,
  REJECTION_PATTERNS,
  COMPETING_FIELD_LABELS,
  classifyQuantityValue,
  classifyMrpValue,
  classifyDateValue,
  getBoxHeight,
  getBoxWidth,
  computeDistance,
  QUANTITY_UNITS,
  normalizeQuantityUnit,
} from './declarationConceptService.js'

/**
 * contextualInferenceService.js
 *
 * Implicit / contextual evidence inference for packaged-commodity declarations.
 *
 * The core rule of this module:
 *   "a bare number is never a declaration without contextual evidence."
 *
 * When the extraction engine finds a standalone value token (e.g. "₹120",
 * "100 g", "08/2026") WITHOUT an explicit declaration label anywhere nearby,
 * this service decides whether the token is plausibly a declaration by
 * evaluating MULTIPLE independent signals:
 *
 *   1. value-shape compatibility with a legal declaration
 *   2. nearby words (label fragments, synonyms, unit words)
 *   3. presence in the conventional declaration region of the package
 *   4. competing candidates (phone, pin, batch, date, dimensions, promo price)
 *   5. typography / prominence
 *   6. neighboring declaration concepts
 *
 * Signal aggregation yields a confidence in [0,1].  Thresholds:
 *
 *   >= 0.80  -> PASS   (strong multi-signal support)
 *   >= 0.55  -> REVIEW (plausible but not fully safe)
 *   <  0.55  -> UNKNOWN / rejected
 *
 * NOTE: confidence here is EVIDENCE confidence, not legal PASS.  The compliance
 * layer still decides PASS/FAIL/REVIEW per its own review-by-default contract.
 */

const HIGH_CONFIDENCE = 0.80
const REVIEW_THRESHOLD = 0.55

/**
 * Converts a raw OCR token into candidate concept interpretations.
 * Returns an array of { concept, raw, parsed, confidence } sorted desc by confidence.
 */
export function inferCandidates(rawText, nearbyContext) {
  const candidates = []

  if (!rawText) return candidates

  // MRP candidate
  const mrp = inferMrp(rawText, nearbyContext)
  if (mrp) candidates.push(mrp)

  // Net quantity candidate
  const nq = inferNetQuantity(rawText, nearbyContext)
  if (nq) candidates.push(nq)

  // Date candidate(s)
  const dates = inferDate(rawText, nearbyContext)
  if (dates) candidates.push(...dates)

  return candidates.sort((a, b) => b.confidence - a.confidence)
}

function nearText(nearbyContext, patterns) {
  if (!nearbyContext || !Array.isArray(nearbyContext.nearbyText)) return false
  return nearbyContext.nearbyText.some(t => patterns.some(p => p.test(t)))
}

/**
 * Shape-based competing-candidate rejection.  Tests the RAW TOKEN only — a
 * phone number, PIN, barcode, date, or dimension-shaped value is rejected as a
 * declaration regardless of surrounding text.
 */
function shapeCompetitor(rawText, excludedConcept) {
  for (const reject of REJECTION_PATTERNS) {
    if (reject.concept === excludedConcept) continue
    if (reject.pattern.test(rawText)) return reject.concept
  }
  return null
}

/**
 * Context-based competing-field rejection.  Only applied when the raw token is
 * a bare number/alphanumeric (no self-identifying format of its own) and a
 * nearby declaration clearly labels a competing field (batch, lot, serial,
 * pin, dosage, ingredient...).  A currency-symbol value is never rejected by
 * this path.
 */
function contextCompetitor(rawText, ctx) {
  const isSelfIdentifying =
    /[₹$€£]|rs\.?|inr|([A-Za-z]{1,12})(?:\s|$)/i.test(rawText)
  if (isSelfIdentifying && !/^\d[\d,]*(?:\.\d{1,2})?$/.test(rawText.trim())) return null
  if (!ctx?.nearbyText || !ctx.nearbyText.length) return null
  return ctx.nearbyText.some((t) => COMPETING_FIELD_LABELS.some((p) => p.test(t)))
    ? 'competing_field_label'
    : null
}

function inferMrp(rawText, ctx) {
  const nearbyJoined = (ctx?.nearbyText || []).join(' ')
  // Money-formatted values (currency symbol / abbreviation / slash-notation)
  const hasCurrency = /[₹$€£]|rs\.?|inr/i.test(rawText)
  const hasSlashNotation = /\d\s*\/-\s*$/.test(rawText.trim()) || /\d\s*\/\s*-/.test(rawText)
  const amountMatch = classifyMrpValue(rawText, nearbyJoined)

  // Bare number (no money formatting) accepted ONLY when a strong MRP label
  // context is directly adjacent (the multi-signal rule).
  const mrpLabelNearby = nearText(ctx, [/max(?:imum)?\s+retail/i, /m\.?\s*r\.?\s*p/i, /retail\s+price/i, /\bprice\b/i])
  const isBareNumber = /^\d[\d,]*(?:\.\d{1,2})?$/.test(rawText.trim())
  const withLabelContext = isBareNumber && mrpLabelNearby

  const valueCandidate = amountMatch.ok
    ? amountMatch.parsed.value
    : (isBareNumber ? Number(rawText.replace(/,/g, '')) : null)

  // If it's a bare number with no MRP context, or not a number, reject.
  if (!(amountMatch.ok || withLabelContext)) return null
  if (!Number.isFinite(valueCandidate) || valueCandidate <= 0) return null

  // Money-formatted tokens are vetted on the ISOLATED amount so that a barcode
  // or unit-price neighbour inside the same OCR node ("BSTT342 129/-.0.61/ml
  // 8901396602491") does not collateral-damage a legitimate rupee amount
  // (Stage 7.12 product_010).  Bare numbers keep the whole-token shape test.
  const competing = amountMatch.ok
    ? shapeCompetitor(String(valueCandidate), 'dimension')
    : shapeCompetitor(rawText, 'dimension') || contextCompetitor(rawText, ctx)
  if (competing) return null

  let confidence = 0
  const signals = []

  if (hasCurrency) {
    confidence += 0.5
    signals.push('implicit_currency_symbol')
  } else if (hasSlashNotation) {
    confidence += 0.5
    signals.push('implicit_slash_notation')
  } else {
    // Bare number: only meaningful alongside an explicit price label.
    confidence += 0.25
    signals.push('bare_number_near_price_label')
  }

  if (mrpLabelNearby) {
    confidence += 0.3
    signals.push('nearby_price_word')
  }
  if (ctx?.declarationRegion) {
    confidence += 0.15
    signals.push('declaration_region')
  }
  if (ctx?.prominent) {
    confidence += 0.1
    signals.push('prominent_typography')
  }

  // A nearby money-formatted value ("₹7" next to "₹129/-") is a competing
  // candidate; recorded for the cross-node competition resolver to weigh.
  if ((ctx?.nearbyText || []).some((t) => /\/\s*-|₹\s*\d|rs\.?\s*\d|max(?:imum)?\s+retail\s+price/i.test(t))) {
    signals.push('nearby_money_candidate')
  }

  // A BARE number must never reach PASS by itself (health-check discipline:
  // its meaning still depends on an explicit price label).  Cap it to exactly
  // the REVIEW threshold so it surfaces as REVIEW rather than being dropped
  // as UNKNOWN.
  if (isBareNumber) {
    confidence = Math.min(confidence, REVIEW_THRESHOLD)
    signals.push('bare_number_capped_review')
  }

  return {
    concept: 'MRP',
    key: 'mrp',
    raw: rawText,
    parsed: { value: valueCandidate, currency: 'INR', inclusiveOfTaxes: /incl/i.test(nearbyJoined) },
    confidence: clamp(confidence),
    signals,
    status: classifyConfidence(confidence),
  }
}

function inferNetQuantity(rawText, ctx) {
  const parsed = classifyQuantityValue(rawText)
  if (!parsed.ok) return null

  // Reject dimensions/measurements that are units but not net quantity
  if (/cm|mm|ft|inch|\bin\b/i.test(rawText)) return null

  // Reject unit-price / density expressions ("0.61/ml", "₹8.5/100g",
  // "per 100ml"): a price-per-unit shape is not the declared net quantity.
  if (/\s*\/\s*(?:ml|millilitre|g|gm|gram|kg|kilogram|l|L|litre|tablet|sachet|unit|pc|pcs)\b/i.test(rawText) ||
      /\bper\s+(?:100\s*)?(?:ml|millilitre|g|gram|kg|kilogram|l|L|litre|tablet|sachet|unit|pc|pcs)\b/i.test(rawText)) {
    return null
  }

  const competing = shapeCompetitor(rawText) || contextCompetitor(rawText, ctx)
  if (competing) return null

  let confidence = 0
  const signals = []

  if (parsed.parsed.kind) {
    confidence += 0.35
    signals.push('recognized_metric_unit')
  }
  const compatible = isCompatibleQuantityRange(parsed.parsed)
  if (compatible) {
    confidence += 0.15
    signals.push('compatible_quantity_range')
  }
  if (ctx?.nearbyText && nearText(ctx, [/net\s+qty/i, /net\s+weight/i, /net\s+volume/i, /qty\b/i, /\bnet\b/i, /weight\b/i, /volume\b/i, /contents?\b/i, /\bw\.?t\.?/i])) {
    confidence += 0.25
    signals.push('nearby_net_quantity_word')
  }
  if (ctx?.declarationRegion) {
    confidence += 0.15
    signals.push('declaration_region')
  }

  return {
    concept: 'NET_QUANTITY',
    key: 'netQuantity',
    raw: rawText,
    parsed: parsed.parsed,
    confidence: clamp(confidence),
    signals,
    status: classifyConfidence(confidence),
  }
}

function inferDate(rawText, ctx) {
  const parsed = classifyDateValue(rawText)
  if (!parsed.ok) return null

  // 'SEE TOP' / 'SEE BOTTOM' type instructional text is not a date.
  if (/^\s*see\s+(?:top|bottom|seal|pack|coding|below)\s*$/i.test(rawText)) return null

  const competing = shapeCompetitor(rawText, 'date') || contextCompetitor(rawText, ctx)
  if (competing) return null

  const interpretations = []
  const regionScore = ctx?.declarationRegion ? 0.15 : 0
  const prominentScore = ctx?.prominent ? 0.05 : 0

  // Detect whether a batch/lot label is nearby.  A date adjacent to a batch
  // label is evidence of a lot code, NOT a manufacture date.  We penalise the
  // MFD interpretation heavily so it can never reach PASS or REVIEW unless an
  // explicit MFD label is also present.
  const batchLabelNearby = ctx?.nearbyText &&
    nearText(ctx, [/\bbatch\b/i, /\blot\b/i, /\bb\.?\s*no\.?\b/i, /\bl\.?\s*no\.?\b/i, /\bbatch\s*no/i, /\blot\s*no/i])
  const batchPenalty = batchLabelNearby ? -0.4 : 0

  // MFD?
  let mfdConf = 0.3 + regionScore + prominentScore + batchPenalty
  const hasMfdLabel = ctx?.nearbyText && nearText(ctx, [/mfd\b/i, /mfg\b/i, /manufactur/i, /date\s+of\s+manufacture/i])
  if (hasMfdLabel) {
    mfdConf += 0.3
  }
  const mfdSignals = [parsed.parsed.granularity === 'MONTH' ? 'month_year_format' : 'day_month_year_format']
  if (hasMfdLabel) mfdSignals.push('nearby_manufacturing_word')
  else mfdSignals.push('no_direct_label')
  if (batchLabelNearby) mfdSignals.push('batch_label_nearby_penalty')

  interpretations.push({
    concept: 'DATE_OF_MANUFACTURE',
    key: 'dateOfManufacture',
    raw: rawText,
    parsed: parsed.parsed,
    confidence: clamp(mfdConf),
    signals: mfdSignals,
    status: classifyConfidence(mfdConf),
  })

  // PKD?
  let pkdConf = 0.3 + regionScore + prominentScore
  const hasPkdLabel = ctx?.nearbyText && nearText(ctx, [/pkd\b/i, /packed\s+on/i, /packing\s+date/i, /date\s+of\s+packing/i])
  if (hasPkdLabel) {
    pkdConf += 0.3
  }
  interpretations.push({
    concept: 'DATE_OF_PACKING',
    key: 'dateOfPacking',
    raw: rawText,
    parsed: parsed.parsed,
    confidence: clamp(pkdConf),
    signals: [parsed.parsed.granularity === 'MONTH' ? 'month_year_format' : 'day_month_year_format', hasPkdLabel ? 'nearby_packing_word' : 'no_direct_label'],
    status: classifyConfidence(pkdConf),
  })

  // EXPIRY?
  let expConf = 0.3 + regionScore + prominentScore
  const hasExpLabel = ctx?.nearbyText && nearText(ctx, [/exp(?:iry|\.)?/i, /use\s+by/i, /best\s+before/i, /bb(?:e)?\b/i])
  if (hasExpLabel) {
    expConf += 0.3
  }
  interpretations.push({
    concept: 'EXPIRY_USE_BY_BEST_BEFORE',
    key: 'expiryOrUseByDate',
    raw: rawText,
    parsed: parsed.parsed,
    confidence: clamp(expConf),
    signals: [parsed.parsed.granularity === 'MONTH' ? 'month_year_format' : 'day_month_year_format', hasExpLabel ? 'nearby_expiry_word' : 'no_direct_label'],
    status: classifyConfidence(expConf),
  })

  return interpretations.sort((a, b) => b.confidence - a.confidence)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCompatibleQuantityRange(parsed) {
  if (!parsed || !parsed.kind) return false
  switch (parsed.kind) {
    case 'MASS': return parsed.value > 0 && parsed.value < 10000
    case 'VOLUME': return parsed.value > 0 && parsed.value < 100000
    case 'NUMBER': return parsed.value >= 1 && parsed.value <= 10000
    default: return parsed.value > 0 && parsed.value < 10000
  }
}

export function classifyConfidence(c) {
  if (c >= HIGH_CONFIDENCE) return 'PASS'
  if (c >= REVIEW_THRESHOLD) return 'REVIEW'
  return 'UNKNOWN'
}

function clamp(c) {
  return Math.max(0, Math.min(1, round2(c)))
}

function round2(c) {
  return Math.round(c * 100) / 100
}

/**
 * Extracts the "declaration region" indicator from a set of nodes.
 * A package declaration tends to be a bottom strip / side panel / back label.
 * Rather than guess product-specific layouts, we accept an optional hint from
 * the caller; without it the region check is neutral (never fabricates).
 */
export function classifyDeclarationRegion(nodes, imageDims) {
  if (!imageDims || !imageDims.width || !imageDims.height) return false
  // Conservative heuristic: the bottom 35% of the image frequently carries
  // the statutory declaration block on Indian packaged products. This is a
  // STATISTICAL prior, not a product-specific coordinate set. It only ever
  // raises confidence slightly and never fabricates a value.
  const height = imageDims.height
  const bottomCut = height * 0.35
  if (!nodes || !nodes.length) return false
  const bottomMost = nodes.some(n => n.bbox && getBoxHeight(n.bbox) > 0 && n.bbox[0][1] >= bottomCut)
  return bottomMost
}

/**
 * Extracts prominent-typography signal from a node relative to its neighbors.
 */
export function isProminentText(node, nodes) {
  if (!node || !nodes || nodes.length < 2) return false
  const h = getBoxHeight(node.bbox)
  if (!h) return false
  const heights = nodes.filter(n => n.bbox).map(n => getBoxHeight(n.bbox)).filter(n => n > 0)
  if (!heights.length) return false
  heights.sort((a, b) => a - b)
  const median = heights[Math.floor(heights.length / 2)]
  return h > median * 1.5
}

/**
 * Finds nearby OCR nodes within a distance radius of a target node.
 */
export function findNearbyNodes(nodes, target, radiusFactor = 6) {
  if (!nodes || !target) return []
  const size = getBoxHeight(target.bbox) || 10
  return nodes
    .filter(n => n !== target && n.bbox)
    .map(n => ({ text: n.text, bbox: n.bbox, confidence: n.confidence, dist: computeDistance(target.bbox, n.bbox) }))
    .filter(n => n.dist > 0 && n.dist < size * radiusFactor)
    .sort((a, b) => a.dist - b.dist)
}