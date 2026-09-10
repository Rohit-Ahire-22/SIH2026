import {
  SOURCE_TYPE,
  classifyMrpValue,
  classifyQuantityValue,
  classifyDateValue,
  getBoxCenter,
  getBoxHeight,
  getBoxWidth,
  getFontSize,
  computeDistance,
  computeBoundingBox,
  normalizeQuantityUnit,
} from './declarationConceptService.js'
import { inferCandidates } from './contextualInferenceService.js'

export const SOURCE_TYPES = SOURCE_TYPE

export const DATE_LABELS = {
  // Matches explicit manufacture-date labels only.  The negative lookahead
  // (?!\s*by\b) prevents "MFD.BY" from matching, and manufacture labels are
  // required to carry an explicit "date"/"on" word so vendor phrases such as
  // "Manufactured&Marketed by", "Manufactured by", "Mfg. by" never anchor a
  // date extraction (see Stage 7.12 defect product_017 mfd=2025-01-01).
  dateOfManufacture: /(?:^|\W)\s*(?:date\s+of\s+manufacture|manufacture\s+date|mfg\.?\s+(?:date|dt)\b|mfd\.?(?!\.?\s*by\b)|manufactur(?:ed|ing)\s+(?:date|on)\b(?!\s+by\b))\s*[:\-.]?\s*/i,
  dateOfPacking: /(?:^|\W)\s*(?:date\s+of\s+packing|packed\s+on|packing\s+date|pkd(?:\.)?)\s*[:\-.]?\s*/i,
  expiryOrUseByDate: /(?:^|\W)\s*(?:expiry\s*(?:date)?|use\s+by|best\s+before|exp(?:\.)?\s*(?:date)?|bbe)\s*[:\-.]?\s*/i,
}

export const MRP_LABEL = /(?:maximum\s+retail\s+price|m\.?\s*r\.?\s*p\.?|max\s+retail\s+price|retail\s+price)/i
export const MONEY_PATTERN = /(?:(?:₹|rs\.?|inr)\s*([\d][\d,]*(?:\.\d+)?))|(?:^|\s)([\d][\d,]*(?:\.\d+)?)(?:\/-)|(?:^|\s)(\d{2,}(?:\.\d+)?)(?=\s|$)/i
export const TAX_INCLUSIVE_PATTERN = /incl(?:usive|\.)?(?:\s*of)?\s+all\s+taxes|including\s+all\s+taxes/i

export const NET_QTY_LABEL = /(?:net\s+(?:quantity|qty|weight|w(?:t)?\.?|vol(?:ume)?|vol\.?)|quantity|weight|contents?)\s*[:\-.]?\s*/i
export const NET_QTY_VALUE = /(\d*\.?\d+)\s*(g|kg|mg|ml|millilitre|milliliter|litre|liter|l|L)\b/i

export const BATCH_LABEL = /\b(?:batch|lot)\s*(?:no\.?|number\.?)?\s*[:.#\-]?\s*/i
export const BATCH_VALUE = /^([A-Za-z0-9][A-Za-z0-9./\-]{1,30})/

export const COUNTRY_PATTERNS = [
  /(?:^|\W)\s*country\s+of\s+origin\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*made\s+in\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*origin\s*[:.\-]?\s*/i,
]

export const MANUFACTURER_PATTERNS = [
  /(?:^|\W)\s*manufactured\s+(?:(?:and|&)\s+)?(?:marketed\s+)?by\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*mf(?:g|d)\.?\s*by\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*marketed\s+by\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*manufacturer\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*packed\s+by\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*pkd\.?\s+by\s*[:.\-]?\s*/i,
  /(?:^|\W)\s*imported\s+(?:(?:and|&)\s+)?(?:marketed\s+)?by\s*[:.\-]?\s*/i,
]

export const CONSUMER_CARE_PATTERN =
  /(?:^|\W)\s*(?:consumer\s+care|consumer\s+complaints|customer\s+care|customer\s+service|helpline|toll[\s-]*free|call|phone|tel)\s*[:.\-]?\s*/i

export const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
// Match generic Indian mobile/landline and 1800 formats, reject plain 6-digit pins
export const PHONE_PATTERN = /(?:\+?91[\s.-]?)?(?:1800[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4}){1,2}|\d{4}[\s.-]?\d{3}[\s.-]?\d{3}|\d{10})\b/

const UNIT_NORMALIZATION = {
  g: 'g', kg: 'kg', mg: 'mg',
  ml: 'ml', mL: 'ml',
  l: 'l', L: 'l', litre: 'l', liter: 'l', litres: 'l', liters: 'l'
}

export function extractProductFields(ocrResults) {
  const lines = reconstructLines(ocrResults)
  const spatialNodes = getSpatialNodes(ocrResults)

  const mrp = extractMrp2D(spatialNodes)
  const netQuantity = extractNetQuantity2D(spatialNodes)
  const batchLotNumber = extractBatchLotNumber2D(spatialNodes)
  const dateOfManufacture = extractDate2D(spatialNodes, DATE_LABELS.dateOfManufacture)
  const dateOfPacking = extractDate2D(spatialNodes, DATE_LABELS.dateOfPacking)
  const expiryOrUseByDate = extractDate2D(spatialNodes, DATE_LABELS.expiryOrUseByDate)
  const countryOfOrigin = extractCountry(lines)
  const manufacturerName = extractManufacturer(lines, spatialNodes)
  const consumerCareDetails = extractConsumerCare(lines, spatialNodes)
  const { brandName, productName } = extractBrandAndProduct(spatialNodes, manufacturerName)

  return {
    mrp,
    netQuantity,
    batchLotNumber,
    dateOfManufacture,
    dateOfPacking,
    expiryOrUseByDate,
    countryOfOrigin,
    manufacturerName,
    consumerCareDetails,
    brandName,
    productName,
  }
}

/**
 * Extracts declarations with full provenance tracking.  Runs the explicit
 * extraction pass, then an IMPLICIT pass that recognizes standalone values
 * (e.g. "₹120", "100 g", "08/2026") without an adjacent declaration label,
 * provided sufficient contextual evidence exists.
 *
 * Every field carries:
 *   concept, value, sourceType, evidence, bbox, confidence, signals, status
 *
 * The result preserves REVIEW semantics: implicit values with weak evidence
 * are surfaced as REVIEW rather than being silently promoted to PASS.
 */
// Canonical evidence value shape:
//   mrp          -> { value, currency, inclusiveOfTaxes }
//   netQuantity  -> { value, unit }
//   dates        -> 'YYYY-MM-DD' string
//   consumerCare -> { phone?, email? }
//   others       -> atomic string
// This guarantees the SAME shape whether the declaration came from the
// explicit or implicit pass, so downstream consumers never branch on
// "number vs object".
export function normalizeEvidenceValue(key, value) {
  if (value === null || value === undefined) return value
  const DATE_KEYS = new Set(['dateOfManufacture', 'dateOfPacking', 'expiryOrUseByDate'])
  if (DATE_KEYS.has(key) && typeof value === 'object') {
    return value.iso || value.full || (
      typeof value.value === 'string' ? value.value : String(value.value ?? '')
    ) || null
  }
  if (key === 'netQuantity' && typeof value === 'object' && value.value !== undefined) {
    return { value: value.value ?? null, unit: value.unit ?? null }
  }
  // Handle atomic numeric netQuantity (raw.value = number).
  if (key === 'netQuantity') {
    return { value, unit: null }
  }
  if (key === 'mrp' && typeof value === 'object' && value.value !== undefined) {
    return {
      value: value.value ?? null,
      currency: value.currency || 'INR',
      inclusiveOfTaxes: Boolean(value.inclusiveOfTaxes),
    }
  }
  if (key === 'mrp') {
    return { value, currency: 'INR', inclusiveOfTaxes: false }
  }
  return value
}

export function extractEvidence(ocrResults, options = {}, precomputedExplicit = null) {
  const nodes = getSpatialNodes(ocrResults)
  const lines = reconstructLines(ocrResults)
  const evidenceMap = {}

  // 1. Explicit pass (existing label-anchored extraction).
  // When the caller has already run extractProductFields (as the orchestrator does),
  // it can pass the result in to avoid running the same extraction twice.
  const explicit = precomputedExplicit !== null ? precomputedExplicit : extractProductFields(ocrResults)

  const normToEvidence = (key, raw, concept) => {
    if (!raw || raw.value === undefined || raw.value === null) return
    if (raw.value === 'REVIEW') {
      evidenceMap[key] = {
        concept,
        value: null,
        sourceType: raw.sourceType || SOURCE_TYPE.EXPLICIT_LABEL,
        evidence: raw.evidence || null,
        bbox: raw.bbox || null,
        confidence: raw.confidence !== undefined ? raw.confidence : 1.0,
        signals: raw.signals || ['explicit_label'],
        status: 'REVIEW',
        rawValue: 'REVIEW',
      }
      return
    }
    const STRUCTURED_VALUE_KEYS = new Set(['mrp', 'netQuantity', 'dateOfManufacture', 'dateOfPacking', 'expiryOrUseByDate'])
    evidenceMap[key] = {
      concept,
      value: normalizeEvidenceValue(key, STRUCTURED_VALUE_KEYS.has(key) ? raw : raw.value),
      sourceType: raw.sourceType || SOURCE_TYPE.EXPLICIT_LABEL,
      evidence: raw.evidence || null,
      bbox: raw.bbox || null,
      confidence: raw.confidence !== undefined ? raw.confidence : 1.0,
      signals: raw.signals || ['explicit_label'],
      status: raw.status || (raw.confidence !== undefined && raw.confidence < 0.75 ? 'REVIEW' : 'PASS'),
    }
  }

  normToEvidence('mrp', explicit.mrp, 'MRP')
  normToEvidence('netQuantity', explicit.netQuantity, 'NET_QUANTITY')
  normToEvidence('batchLotNumber', explicit.batchLotNumber, 'BATCH_LOT')
  normToEvidence('dateOfManufacture', explicit.dateOfManufacture, 'DATE_OF_MANUFACTURE')
  normToEvidence('dateOfPacking', explicit.dateOfPacking, 'DATE_OF_PACKING')
  normToEvidence('expiryOrUseByDate', explicit.expiryOrUseByDate, 'EXPIRY_USE_BY_BEST_BEFORE')
  normToEvidence('countryOfOrigin', explicit.countryOfOrigin, 'COUNTRY_OF_ORIGIN')
  normToEvidence('manufacturerName', explicit.manufacturerName, 'MANUFACTURER')
  normToEvidence('consumerCareDetails', explicit.consumerCareDetails, 'CONSUMER_CARE')
  normToEvidence('brandName', explicit.brandName, 'BRAND')
  normToEvidence('productName', explicit.productName, 'GENERIC_NAME')

  // 2. Implicit pass (contextual inference on standalone values)
  const implicit = extractImplicitDeclarations(nodes, options, evidenceMap)

  // 3. Merge: implicit fills gaps; explicit always wins on the same field.
  for (const [key, value] of Object.entries(implicit)) {
    if (!evidenceMap[key]) {
      evidenceMap[key] = value
    } else if (evidenceMap[key].status === 'REVIEW' && value.status !== 'REVIEW') {
      // Only promote a REVIEW to a stronger IMPLICIT if the implicit signal is
      // genuinely stronger; otherwise keep both and let the consumer decide.
      if (value.confidence > (evidenceMap[key].confidence || 0)) {
        evidenceMap[key] = value
      }
    }
  }

  // 4. Date-relationship reconciliation (downgrade-only, fail-closed).
  // `explicit === precomputedExplicit` shares the reference that the caller's
  // applyEvidenceToProduct reads, so mutating it here keeps every consumer
  // (product fields, evidence fusion, measurement evidence) consistent.
  reconcileDateRelationships(explicit, evidenceMap)

  return evidenceMap
}

/**
 * Detects standalone declaration values ("₹120", "100 g", "08/2026") that are
 * NOT anchored to an explicit label, using geometry + contextual signals.
 *
 * Candidates for the same declaration key are pooled ACROSS nodes and resolved
 * together, because scan-order last-writer-wins silently discarded a competing
 * value ("₹7" next to "₹129/-" -> Stage 7.12 product_010).  A single node may
 * still fill at most ONE field (per-node `break`) so one token like "08/2026"
 * is never simultaneously declared as MFD, pack date AND expiry.
 */
const COMPETITION_AMBIGUITY_MARGIN = 0.15

function extractImplicitDeclarations(nodes, options, evidenceMap) {
  const result = {}
  if (!nodes || !nodes.length) return result

  const occupiedBoxes = Object.values(evidenceMap).filter(v => v.bbox).map(v => v.bbox)
  const imageDims = options.imageDimensions

  const pending = new Map()

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const text = node.text
    if (!text) continue

    // Skip nodes already consumed by explicit extraction.
    if (isConsumedByEvidence(text, evidenceMap)) continue
    // Skip nodes that look like pure labels (no value on their own).
    if (isLabel(text)) continue

    const nearby = findNearbyNodes(nodes, node)
    const nearbyTexts = nearby.map(n => n.text)
    const region = imageDims ? classifyRegion(nodes, node, imageDims) : null

    const candidates = inferCandidates(text, {
      nearbyText: nearbyTexts,
      declarationRegion: region,
      prominent: isProminent(node, nodes),
    })

    for (const cand of candidates) {
      // A single standalone value (e.g. "08/2026") must map to at most ONE
      // concept: storing it as MFD and expiry and pack date simultaneously
      // would fabricate three declarations from one token.  Per-node break.
      if (!evidenceMap[cand.key]) {
        // UNKNOWN (< 0.55) means insufficient context to safely declare the
        // value; weak inference stays out of the evidence map and the field
        // fails closed to REVIEW.
        if (cand.status === 'UNKNOWN') continue
        if (!pending.has(cand.key)) pending.set(cand.key, [])
        pending.get(cand.key).push({ cand, node, nearby, nearbyTexts })
        break
      }
    }
  }

  for (const [key, entries] of pending) {
    const winner = resolveCandidateCompetition(key, entries)
    const bbox = computeBoundingBox([winner.node.bbox, ...winner.nearby.slice(0, 2).map(n => n.bbox)].filter(Boolean))
    result[key] = {
      concept: winner.cand.concept,
      value: normalizeEvidenceValue(key, winner.cand.parsed),
      sourceType: SOURCE_TYPE.IMPLICIT_CONTEXT,
      evidence: winner.node.text + (winner.nearbyTexts.length ? ' ' + winner.nearbyTexts.slice(0, 3).join(' ') : ''),
      bbox,
      confidence: winner.cand.confidence,
      signals: winner.signals,
      status: winner.cand.status,
    }
  }
  return result
}

/**
 * Resolves competing implicit candidates for the same field found in different
 * OCR nodes.  A narrow confidence margin leaves the field genuinely ambiguous
 * -> REVIEW (fail closed, never a confident guess).  For MRP, a money-formatted
 * value is preferred over a bare number when the gap is small, because bare
 * numbers were only ever allowed REVIEW-level confidence next to a price label.
 */
function resolveCandidateCompetition(key, entries) {
  const sorted = [...entries].sort((a, b) => b.cand.confidence - a.cand.confidence)
  let winner = sorted[0]
  const signals = [...winner.cand.signals, `candidate_count:${sorted.length}`]

  const isMoneyFormatted = (e) => e.cand.signals.some((s) => s === 'implicit_currency_symbol' || s === 'implicit_slash_notation')

  if (key === 'mrp') {
    const money = sorted.find(isMoneyFormatted)
    if (money && money !== winner && money.cand.confidence >= winner.cand.confidence - 0.1) {
      signals.push(`rejected_mrp_candidate:${winner.cand.raw}`)
      winner = money
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== winner) signals.push(`rejected_candidate_${i}:${sorted[i].cand.raw}`)
    if (winner.cand.confidence - sorted[i].cand.confidence < COMPETITION_AMBIGUITY_MARGIN) {
      signals.push('competing_candidates_ambiguous')
      winner = { ...winner, cand: { ...winner.cand, status: 'REVIEW' } }
      break
    }
  }

  return { ...winner, signals }
}

/**
 * Downgrade-only date-chain reconciliation (never upgrades).  expiry < mfd,
 * expiry < pack-date, or expiry === pack-date are impossible for a real
 * package; they indicate token reuse by OCR (e.g. product_017 dup use-by).
 * Mutates BOTH the raw explicit result (which applyEvidenceToProduct reads)
 * and the evidence map (which compliance fusion reads), fail-closed to REVIEW.
 */
function reconcileDateRelationships(explicit, evidenceMap) {
  const conflict = (k) => {
    const mk = explicit && explicit[k]
    if (mk && mk.value && mk.value !== 'REVIEW') mk.value = 'REVIEW'
    const ev = evidenceMap[k]
    if (ev && ev.value && ev.status !== 'REVIEW') {
      evidenceMap[k] = {
        ...ev,
        status: 'REVIEW',
        signals: [...(ev.signals || []), 'date_relationship_conflict_downgraded'],
      }
    }
  }

  const mfd = explicit?.dateOfManufacture?.value
  const pkd = explicit?.dateOfPacking?.value
  const exp = explicit?.expiryOrUseByDate?.value
  if (!exp || exp === 'REVIEW') return

  if (mfd && mfd !== 'REVIEW' && exp < mfd) {
    conflict('expiryOrUseByDate')
    conflict('dateOfManufacture')
  }
  if (pkd && pkd !== 'REVIEW' && exp <= pkd) {
    conflict('expiryOrUseByDate')
    conflict('dateOfPacking')
  }
}

function isConsumedByEvidence(text, evidenceMap) {
  const tokens = Object.values(evidenceMap).map(v => String(v.evidence || '')).join(' | ').toLowerCase()
  return tokens.includes(text.toLowerCase().trim())
}

function findNearbyNodes(nodes, target) {
  if (!nodes || !target) return []
  const size = getFontSize(target.bbox)
  return nodes
    .filter(n => n !== target && n.bbox)
    .map(n => ({ text: n.text, bbox: n.bbox, confidence: n.confidence, dist: computeDistance(target.bbox, n.bbox) }))
    .filter(n => n.dist > 0 && n.dist < size * 6)
    .sort((a, b) => a.dist - b.dist)
}

function isProminent(node, nodes) {
  if (!node || !nodes || nodes.length < 2) return false
  const h = getBoxHeight(node.bbox)
  if (!h) return false
  const heights = nodes.filter(n => n.bbox).map(n => getBoxHeight(n.bbox)).filter(n => n > 0)
  if (!heights.length) return false
  heights.sort((a, b) => a - b)
  const median = heights[Math.floor(heights.length / 2)]
  return h > median * 1.5
}

function classifyRegion(nodes, node, imageDims) {
  if (!imageDims || !imageDims.height) return false
  if (!node.bbox) return false
  // Statistical prior: the lower 35% of the image commonly hosts the
  // statutory declaration block on Indian retail packages. Used ONLY as a
  // weak positive signal (never as proof of absence).
  return node.bbox[0][1] >= imageDims.height * 0.65
}

export function getSpatialNodes(ocrResults) {
  if (!ocrResults || !Array.isArray(ocrResults)) return [];
  if (ocrResults.length > 0 && typeof ocrResults[0] === 'string') {
     return ocrResults.map((text, i) => ({
        text,
        confidence: 0.9,
        bbox: [[0, i*20], [100, i*20], [100, i*20+15], [0, i*20+15]]
     }));
  }
  return ocrResults.filter(r => r && typeof r.text === 'string' && Array.isArray(r.bbox || r.box)).map(r => ({
    text: r.text,
    bbox: r.bbox || r.box,
    confidence: r.confidence || 1.0
  }));
}

function averageConfidence(confidences) {
  const valid = confidences.filter(c => c !== undefined && c !== null);
  if (valid.length === 0) return 1.0;
  const sum = valid.reduce((a, b) => a + b, 0);
  return sum / valid.length;
}

function reconstructLines(ocrResults) {
  if (!Array.isArray(ocrResults)) return []
  
  const valid = ocrResults.filter((r) => r && typeof r.text === 'string' && Array.isArray(r.bbox || r.box))
  if (valid.length === 0) {
    return ocrResults.map((entry) => {
      const text = typeof entry === 'string' ? entry : (entry && typeof entry.text === 'string' ? entry.text : '')
      return { text, bbox: undefined, confidence: 1.0, height: 10 }
    }).filter(l => l.text)
  }

  const blocks = valid.map((r) => {
    const box = r.bbox || r.box;
    const ys = box.map((p) => p[1])
    const xs = box.map((p) => p[0])
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const minX = Math.min(...xs)
    const yCenter = (minY + maxY) / 2
    const height = maxY - minY
    return { text: r.text, minX, yCenter, height, box, confidence: r.confidence || 1.0 }
  })

  blocks.sort((a, b) => a.yCenter - b.yCenter)

  const lines = []
  let currentLine = []

  for (const block of blocks) {
    if (currentLine.length === 0) {
      currentLine.push(block)
    } else {
      const prevBlock = currentLine[currentLine.length - 1]
      const avgHeight = (block.height + prevBlock.height) / 2
      if (Math.abs(block.yCenter - prevBlock.yCenter) < avgHeight * 0.5) {
        currentLine.push(block)
      } else {
        lines.push(currentLine)
        currentLine = [block]
      }
    }
  }
  if (currentLine.length > 0) lines.push(currentLine)

  return lines.map((line) => {
    line.sort((a, b) => a.minX - b.minX)
    const maxH = Math.max(...line.map(b => b.height));
    return {
      text: line.map((b) => b.text).join(' '),
      bbox: computeBoundingBox(line.map(b => b.box)),
      confidence: averageConfidence(line.map(b => b.confidence)),
      height: maxH
    }
  })
}

function isLabel(lineStr) {
  if (MRP_LABEL.test(lineStr)) return true;
  if (NET_QTY_LABEL.test(lineStr)) return true;
  if (BATCH_LABEL.test(lineStr)) return true;
  for (const p of Object.values(DATE_LABELS)) if (p.test(lineStr)) return true;
  if (CONSUMER_CARE_PATTERN.test(lineStr)) return true;
  for (const p of COUNTRY_PATTERNS) if (p.test(lineStr)) return true;
  for (const p of MANUFACTURER_PATTERNS) if (p.test(lineStr)) return true;
  return false;
}

function find2DField(nodes, labelPattern, valuePattern, rejectPattern, valueExtractor) {
  let candidates = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const anchor = nodes[i];
    const labelMatch = labelPattern.exec(anchor.text);
    
    if (labelMatch) {
      const combinedText = anchor.text.slice(labelMatch.index + labelMatch[0].length).trim();
      let valMatch = valuePattern.exec(combinedText);
      if (valMatch && (!rejectPattern || !rejectPattern.test(valMatch[1] || valMatch[2] || valMatch[3] || valMatch[0]))) {
         const extracted = valueExtractor(valMatch, anchor.text, combinedText, true);
         if (extracted) {
            candidates.push({ ...extracted, evidence: anchor.text, bbox: anchor.bbox, confidence: anchor.confidence, dist: 0, sourceType: SOURCE_TYPE.EXPLICIT_LABEL });
            continue;
         }
      }
      
      const anchorSize = getFontSize(anchor.bbox);
      const maxDist = anchorSize * 6; // Reasonable threshold to prevent cross-package false positives
      
      const neighbors = nodes
        .filter(b => b !== anchor && b.bbox)
        .map(b => ({ box: b, dist: computeDistance(anchor.bbox, b.bbox) }))
        .filter(n => n.dist > 0 && n.dist < maxDist)
        .sort((a, b) => a.dist - b.dist);
        
      for (const neighbor of neighbors) {
        let valMatch = valuePattern.exec(neighbor.box.text);
        if (valMatch && (!rejectPattern || !rejectPattern.test(valMatch[1] || valMatch[2] || valMatch[3] || valMatch[0]))) {
           const extracted = valueExtractor(valMatch, neighbor.box.text, neighbor.box.text, false);
           if (extracted) {
              const evidence = anchor.text + ' ' + neighbor.box.text;
              const bbox = computeBoundingBox([anchor.bbox, neighbor.box.bbox]);
              const conf = averageConfidence([anchor.confidence, neighbor.box.confidence]);
              candidates.push({ ...extracted, evidence, bbox, confidence: conf, dist: neighbor.dist, sourceType: SOURCE_TYPE.SPATIAL_ASSOCIATION });
              break; 
           }
        }
        
        const nextNeighbors = nodes
          .filter(b => b !== anchor && b !== neighbor.box && b.bbox)
          .map(b => ({ box: b, dist: computeDistance(neighbor.box.bbox, b.bbox) }))
          .filter(n => n.dist > 0 && n.dist < anchorSize * 8)
          .sort((a, b) => a.dist - b.dist);
          
        for (const nextNeighbor of nextNeighbors) {
           const combined = neighbor.box.text + ' ' + nextNeighbor.box.text;
           let valMatch = valuePattern.exec(combined);
           if (valMatch && (!rejectPattern || !rejectPattern.test(valMatch[1] || valMatch[2] || valMatch[3] || valMatch[0]))) {
             const extracted = valueExtractor(valMatch, combined, combined, false);
             if (extracted) {
                const evidence = anchor.text + ' ' + combined;
                const bbox = computeBoundingBox([anchor.bbox, neighbor.box.bbox, nextNeighbor.box.bbox]);
                const conf = averageConfidence([anchor.confidence, neighbor.box.confidence, nextNeighbor.box.confidence]);
                candidates.push({ ...extracted, evidence, bbox, confidence: conf, dist: neighbor.dist, sourceType: SOURCE_TYPE.SPATIAL_ASSOCIATION });
                break;
             }
           }
        }
      }
    }
  }
  
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.length > 0 ? candidates[0] : null;
}

// Shape-based rejection filter — base rules applied to all numeric fields.
//
// Rejects values whose SHAPE indicates a non-declaration context:
//   1. Phone/toll-free   2. PIN code   3. Barcode   4. Date-formatted strings
const REJECT_NUMBERS = /^(?:\+?91[\s.-]?)?(?:1800[\s.-]?\d{2,4}[\s.-]?\d{3,4}|(?:\d{4}[\s.-]?\d{3}[\s.-]?\d{3})|\d{10})$|^\d{5,6}$|^\d{12,14}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/

// MRP-specific rejection: extends the base rejections with shapes that are
// nonsensical as a Maximum Retail Price even when adjacent to an MRP label.
//
//   5. Year-shaped:  standalone 4-digit number in 1800–2099 (lot-code years)
//   6. Single-digit: bare 1–9 without currency/unit (nonsensical MRP)
//   7. 5-digit:      postal-code shaped (already covered by REJECT_NUMBERS)
//   8. 7–11 digits:  goods/GS1 part-number, licence or registration-code shaped
//      (never a retail MRP; e.g. Stage 7.12 product_008 "013000101")
const REJECT_NUMBERS_MRP = /^(?:\+?91[\s.-]?)?(?:1800[\s.-]?\d{2,4}[\s.-]?\d{3,4}|(?:\d{4}[\s.-]?\d{3}[\s.-]?\d{3})|\d{10})$|^\d{5,6}$|^\d{7,11}$|^\d{12,14}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^(?:1[89]\d{2}|20\d{2})$|^\d$/

function extractMrp2D(nodes) {
  return find2DField(nodes, MRP_LABEL, MONEY_PATTERN, REJECT_NUMBERS_MRP, (match, text, combinedText, isAnchor) => {
    // Bare-number matches (match[3]) are accepted when the anchor (the MRP
    // label node) is explicitly adjacent and supplies the semantic context.
    // This correctly pairs the common "MRP" + "120" split-box OCR layout via
    // spatial association. REJECT_NUMBERS still blocks phone/PIN/date shapes.
    const rawAmount = match[1] || match[2] || match[3]
    const value = parseFloat(rawAmount.replace(/,/g, ''))
    if (Number.isFinite(value) && value > 0) {
      let inclusive = TAX_INCLUSIVE_PATTERN.test(combinedText) || TAX_INCLUSIVE_PATTERN.test(text);
      if (!inclusive) {
        // Search all nodes for tax inclusive wording
        inclusive = nodes.some(n => TAX_INCLUSIVE_PATTERN.test(n.text));
      }
      return { value, currency: "INR", inclusiveOfTaxes: inclusive };
    }
    return null;
  });
}

function extractNetQuantity2D(nodes) {
  return find2DField(nodes, NET_QTY_LABEL, NET_QTY_VALUE, REJECT_NUMBERS, (match) => {
    const value = parseFloat(match[1])
    const unit = UNIT_NORMALIZATION[match[2]] || match[2].toLowerCase()
    if (Number.isFinite(value) && value >= 0 && unit) {
      return { value, unit };
    }
    return null;
  });
}

// Stray label / prose tokens that must never be reported as a lot code.  These
// are generic English divider words (NOT product-specific); they appear because
// OCR merges "Batch No." with the NEXT label instead of the code value
// (Stage 7.12: INDICATES, Pkd, M.R.P.Incl, MFG.DATE, and).
const BATCH_PROSE_PATTERN = /^(?:and|or|of|the|for|see|top|bottom|seal|pack|coding|code|below|area|year|first|second|two|three|left|right|characters?|months?|month|from|before|after|best|use|by|with|within|inside|outside|indicat(?:es|e|ing|or)|shows?|printed|pkd|packed|mfg|mfd|mrp|incl(?:usive)?|exp(?:iry|\.)?|date|dates?|no\.?|batch|lot)\b/i

// Quantity-shaped values ("42g", "10kg", "5 ml") are a different declaration;
// they must not be recycled as a lot code just because they sit near a label.
const BATCH_QUANTITY_PATTERN = /^\d+(?:\.\d+)?\s*(?:g|kg|mg|ml|L|l|cm|mm|%|pc|pcs)\b/i

// Phone-shaped codes belong to consumer-care, never to batch/lot.
const BATCH_PHONE_PATTERN = /^(?:\+?91[\s.-]?)?(?:1800[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4}){1,2}|\d{4}[\s.-]?\d{3}[\s.-]?\d{3}|\d{10})$/

/**
 * A lot code must LOOK like a code before it is reported:
 *   - at least 2 chars, at most 20
 *   - not a stray English label/divider token
 *   - not a quantity-shaped value
 *   - not a phone number
 *   - contains at least one digit AND either (contains letters) or is a
 *     multi-digit (>=4 digit) numeric run (so "33-01-2025" is kept while a
 *     bare count like "24" is not).
 */
function isPlausibleBatchCode(raw) {
  const value = (raw || '').trim()
  if (!value || value.length < 2 || value.length > 20) return false
  if (BATCH_PROSE_PATTERN.test(value)) return false
  if (BATCH_QUANTITY_PATTERN.test(value)) return false
  if (BATCH_PHONE_PATTERN.test(value)) return false
  const hasDigit = /\d/.test(value)
  if (!hasDigit) return false
  if (/[A-Za-z]/.test(value)) return true
  const numericLength = value.replace(/[^\d]/g, '').length
  return numericLength >= 4
}

function extractBatchLotNumber2D(nodes) {
  return find2DField(nodes, BATCH_LABEL, BATCH_VALUE, null, (match, text, combinedText) => {
    if (/see\s+(?:top|bottom|seal|pack|below|coding)/i.test(combinedText) || /see\s+(?:top|bottom|seal|pack|below|coding)/i.test(text)) {
      return { value: 'REVIEW' };
    }
    const value = stripTrailingPeriod(match[1]).trim()
    if (!isPlausibleBatchCode(value)) return null
    return { value };
  });
}

function extractDate2D(nodes, labelPattern) {
  return find2DField(nodes, labelPattern, /.*/, null, (match, text, combinedText) => {
    if (/see\s+(?:top|bottom|seal|pack|below|coding)/i.test(combinedText) || /see\s+(?:top|bottom|seal|pack|below|coding)/i.test(text)) {
      return { value: 'REVIEW' };
    }
    let parsed = parseDate(combinedText) || parseDate(text);
    if (parsed) return { value: parsed };
    return null;
  });
}

/**
 * Rejects a date candidate that sits right after a Rupee/price token.
 * Without this guard "Rs.5.00 (INCL.OF ALL TAXES)" would read as month 5 /
 * year 2000 and fabricate an expiry (Stage 7.12 product_004).
 */
function isMoneyPrefixedDate(text, index) {
  if (index <= 0) return false
  const tail = text.slice(0, index)
  return /(?:₹|rs\.?|inr|mrp|max(?:imum)?\s+retail\b|retail\s+price|price\b|incl(?:\.|usive)?(?:\s*of)?\s*all\s*taxes?)\s*$/i.test(tail)
}

/**
 * Rejects a month-year interpretation when the candidate is glued to a previous
 * digit run by a separator ("1800-10-22", "33-01-2025"). Those shapes are
 * toll-free numbers / lot codes, not dates (Stage 7.12 products 020 and 017).
 */
function precededByDigitRun(text, index) {
  if (index <= 0) return false
  const tail = text.slice(0, index)
  return /[\d.,][\s/.\-]\s*$/.test(tail) && /\d/.test(tail)
}

function parseDate(raw) {
  const text = raw.trim()
  if (!text) return null

  // Full dates (day-month-year) first: "28-07-2026", "12/08/2026", "1 JAN 2026".
  const dmy = /(?<!\d)(0?[1-9]|[12]\d|3[01])[\s/.\-](0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4}|\d{2})(?!\d)/g
  let m
  while ((m = dmy.exec(text)) !== null) {
    if (isMoneyPrefixedDate(text, m.index) || precededByDigitRun(text, m.index)) continue
    let year = m[3]
    if (year.length === 2) year = '20' + year
    const iso = buildIsoDate(year, m[2], m[1])
    if (iso) return iso
  }

  // Month-year fallback: "08/2026", "05-2025".  More dangerous than full dates
  // (a mere code fragment can look like MM.YY), hence guarded extra strictly.
  const my = /(?<!\d)(0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4}|\d{2})(?!\d)/g
  let n
  while ((n = my.exec(text)) !== null) {
    if (isMoneyPrefixedDate(text, n.index) || precededByDigitRun(text, n.index)) continue
    let year = n[2]
    if (year.length === 2) year = '20' + year
    const iso = buildIsoDate(year, n[1], '01')
    if (iso) return iso
  }
  return null
}

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}

function buildIsoDate(yearStr, monthStr, dayStr) {
  const year = Number(yearStr)
  let month = Number(monthStr)
  if (isNaN(month) && typeof monthStr === 'string') {
    const m = monthStr.toLowerCase().slice(0, 3)
    if (MONTH_MAP[m]) month = MONTH_MAP[m]
  }
  const day = Number(dayStr)
  if (year < 1900 || year > 2100 || isNaN(month)) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

function extractCountry(lines) {
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of COUNTRY_PATTERNS) {
      const match = pattern.exec(lines[i].text)
      if (!match) continue
      let value = lines[i].text.slice(match.index + match[0].length).trim()
      let evidenceText = lines[i].text;
      let bbox = lines[i].bbox;
      let confidence = lines[i].confidence;
      if (!value && i + 1 < lines.length) {
        value = lines[i + 1].text.trim()
        evidenceText += ' ' + value;
        bbox = computeBoundingBox([bbox, lines[i+1].bbox]);
        confidence = averageConfidence([confidence, lines[i+1].confidence]);
      }
      value = stripTrailingPeriod(value)
      if (/[A-Za-z]/.test(value)) return { value, evidence: evidenceText, bbox, confidence, sourceType: SOURCE_TYPE.EXPLICIT_LABEL }
    }
  }
  return null
}

const MANUFACTURER_STOP_PATTERNS = [
  /trademark|registered|copyright|©|®|™/i,
  /based\s+on\s+lab\s+test/i,
  /po\s+box|mumbai\s*\d{6}|pin\s*\d{6}/i,
  // Stop at date-like values so "Mfg by XYZ 08/2026" does not swallow a date.
  /^\d{1,2}[\s/.\-]\d{1,2}[\s/.\-]\d{2,4}$|^\d{1,2}[\s/.\-]\d{4}$|^[A-Za-z]{3}[\s/.\-]\d{4}$/,
  // Stop at standalone numbers / phone-like tokens.
  /^\d[\d\s./\-]{3,}$/,
  /^\+?91[\s.-]?\d+$/,
];

function extractManufacturer(lines, nodes) {
  const rawBoxes = nodes.filter(n => n.bbox && n.text);
  
  for (let i = 0; i < rawBoxes.length; i++) {
    for (const pattern of MANUFACTURER_PATTERNS) {
      const match = pattern.exec(rawBoxes[i].text)
      if (!match) continue
      
      let value = rawBoxes[i].text.slice(match.index + match[0].length).trim()
      let evidenceText = rawBoxes[i].text;
      let bbox = rawBoxes[i].bbox;
      let confidence = rawBoxes[i].confidence;
      
      const neighbors = rawBoxes
        .filter(b => b.text !== rawBoxes[i].text && b.text !== evidenceText)
        .map(b => ({ box: b, dist: computeDistance(bbox, b.bbox) }))
        .sort((a, b) => a.dist - b.dist);
        
      for (const neighbor of neighbors) {
        if (neighbor.dist > getFontSize(bbox) * 8) break; // Spatial drop-off
        
        const txt = neighbor.box.text;
        
        // Stop conditions
        if (isLabel(txt)) break;
        if (MANUFACTURER_STOP_PATTERNS.some(p => p.test(txt))) break;
        
        // Only append if it's not a duplicate of what we already have
        if (!value.includes(txt)) {
           value += ' ' + txt;
           evidenceText += ' ' + txt;
           bbox = computeBoundingBox([bbox, neighbor.box.bbox]);
           confidence = averageConfidence([confidence, neighbor.box.confidence]);
        }
      }

      value = stripTrailingPeriod(value).trim()
      if (/[A-Za-z]/.test(value)) return { value, evidence: evidenceText, bbox, confidence, sourceType: SOURCE_TYPE.EXPLICIT_LABEL }
    }
  }
  return null
}

function extractConsumerCare(lines, nodes) {
  return find2DField(nodes, CONSUMER_CARE_PATTERN, /.*/, null, (match, text, combinedText) => {
    const details = {}
    const email = EMAIL_PATTERN.exec(combinedText) || EMAIL_PATTERN.exec(text);
    if (email) details.email = email[0]
    
    const phone = PHONE_PATTERN.exec(combinedText) || PHONE_PATTERN.exec(text);
    if (phone) {
      if (!/^\d{6}$/.test(phone[0])) details.phone = phone[0];
    }
    
    if (details.email || details.phone) return { value: details }
    return null;
  });
}

const BRAND_LABELS = /(?:^|\W)\s*(?:brand(?:s|ed|ing)?(?:\s+name)?|marketed\s*under|sold\s*under|a\s+product\s+of)\s*[:.\-]?\s*/i;
const PRODUCT_LABELS = /(?:^|\W)\s*(?:product(?:\s+name|\s+description)?|common\s+name|description|type|variant)\s*[:.\-]?\s*/i;
const PRODUCT_KEYWORDS = /dishwash|detergent|powder|liquid|paste|cream|shampoo|soap|wash|cleaner|rice|spices|biscuits/i;
const TRADEMARK_INDICATORS = /®|™|registered\s+trademark|trademark/i;
const GENERIC_PROMOTIONAL_WORDS = /^(?:new|fresh|premium|classic|natural|power|easy|super|ultra|mega|active|plus|pro|advanced|expert|pure|clean|shine|glow|excel|perfect|magic|smart|strong|soft|gentle|care|defense|protect|shield|max|extra|gold|silver|platinum|organic|herbal|ayurvedic)$/i;

const GENERAL_NEGATIVE_PATTERNS = [
  ...COUNTRY_PATTERNS,
  ...MANUFACTURER_PATTERNS,
  CONSUMER_CARE_PATTERN,
  EMAIL_PATTERN,
  PHONE_PATTERN,
  /po\s+box|pin\s*\d{6}|www\.|.com/i,
  MRP_LABEL,
  NET_QTY_LABEL,
  BATCH_LABEL,
  ...Object.values(DATE_LABELS),
  /ingredients|nutrition|facts/i,
  /manufactur(?:ed|ing)\s+in|packed\s+in|imported\s+in/i,
  /keep\s+(?:away|out)|store\s+(?:in|away)|lab\s+test/i,
  /dist(?:\.|rict)|estate|plot|floor|building|mumbai|delhi|bangalore|hyderabad|chennai/i
];

function isNegativeCandidate(text, manufacturerName) {
   if (!text || text.length < 2) return true;
   for (const p of GENERAL_NEGATIVE_PATTERNS) {
      if (p.test(text)) return true;
   }
   if (manufacturerName && manufacturerName.value) {
      const textClean = text.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      const mfgClean = manufacturerName.value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      if (textClean.length > 4 && (mfgClean.includes(textClean) || textClean.includes(mfgClean))) return true;
   }
   const numericDensity = (text.match(/\d/g) || []).length / text.length;
   if (numericDensity > 0.4) return true;
   return false;
}

export function extractBrandAndProduct(nodes, manufacturerName) {
   const rawBoxes = nodes.filter(n => n.bbox && n.text);
   if (rawBoxes.length === 0) return { brandName: null, productName: null };
   const fontSizes = rawBoxes.map(b => getFontSize(b.bbox)).sort((a,b) => a-b);
   const medianFontSize = fontSizes[Math.floor((fontSizes.length - 1) / 2)];

   let brandCandidate = null;
   let brandScore = 0;

   // 1. Find Brand
   for (let i = 0; i < rawBoxes.length; i++) {
       const box = rawBoxes[i];
       if (isNegativeCandidate(box.text, manufacturerName)) continue;

       let score = 0;
       const signals = [];

       const size = getFontSize(box.bbox);
       if (size > medianFontSize * 1.5) {
           score += 2;
           signals.push("large_prominent_text");
       } else if (size > medianFontSize * 1.2) {
           score += 1;
           signals.push("prominent_text");
       }

       if (box.confidence > 0.9) {
           score += 1;
           signals.push("high_confidence");
       } else if (box.confidence < 0.6) {
           score -= 2;
       }

       if (TRADEMARK_INDICATORS.test(box.text)) {
           score += 4;
           signals.push("trademark_context_inside");
       }
       if (BRAND_LABELS.test(box.text)) {
           score += 4;
           signals.push("explicit_brand_label_inside");
       }

       const neighbors = rawBoxes
         .filter(b => b !== box)
         .map(b => ({ box: b, dist: computeDistance(box.bbox, b.bbox) }))
         .filter(n => n.dist > 0 && n.dist < size * 10);

       for (const n of neighbors) {
           if (BRAND_LABELS.test(n.box.text)) {
               score += 5;
               signals.push("explicit_brand_label_nearby");
           }
           if (TRADEMARK_INDICATORS.test(n.box.text) && n.dist < size * 6) {
               score += 3;
               signals.push("trademark_nearby");
               if (box.text.length > 2 && n.box.text.toLowerCase().includes(box.text.toLowerCase())) {
                   score += 5;
                   signals.push("trademark_contains_candidate");
               }
           }
       }

       if (/^[A-Za-z\s]+$/.test(box.text)) {
           score += 1;
           signals.push("clean_alphabetic_text");
       }
       
       const isGeneric = GENERIC_PROMOTIONAL_WORDS.test(box.text.trim());
       if (isGeneric) {
           score -= 4;
           signals.push("generic_promotional_word");
       }
       
       if (box.text.length > 20) score -= 3;

       const hasStrongSemanticEvidence = signals.some(s => s.includes("explicit_brand_label") || s.includes("trademark"));
       
       let status = hasStrongSemanticEvidence ? 'PASS' : 'REVIEW';
       if (isGeneric) {
           status = 'REVIEW'; // Never PASS a standalone generic word
       }
       
       let extractionConfidence = box.confidence;
       if (!hasStrongSemanticEvidence) {
           // Cap extraction confidence if there's no semantic evidence to avoid false certainty
           extractionConfidence = Math.min(box.confidence, 0.6);
       } else if (isGeneric) {
           // Even with semantic evidence, cap generic words to represent uncertainty of partial extraction
           extractionConfidence = Math.min(box.confidence, 0.75);
       }

       if (score >= 4 && score > brandScore) {
           brandScore = score;
           brandCandidate = {
               value: box.text.replace(TRADEMARK_INDICATORS, '').replace(BRAND_LABELS, '').trim(),
               evidence: box.text,
               bbox: box.bbox,
               confidence: extractionConfidence,
               status: status,
               source: 'computed',
               score,
               signals
           };
       }
   }
   
   if (brandCandidate) {
       const anchorSize = getFontSize(brandCandidate.bbox);
       const neighbors = rawBoxes
         .filter(b => b.text !== brandCandidate.evidence && !isNegativeCandidate(b.text, manufacturerName))
         .map(b => ({ box: b, dist: computeDistance(brandCandidate.bbox, b.bbox) }))
         .filter(n => n.dist > 0 && n.dist < anchorSize * 4)
         .sort((a,b) => a.dist - b.dist);
         
       for (const n of neighbors) {
           const nSize = getFontSize(n.box.bbox);
           if (nSize > anchorSize * 0.7 && nSize < anchorSize * 1.3) {
               if (/^[A-Za-z]+$/.test(n.box.text) && !PRODUCT_KEYWORDS.test(n.box.text)) {
                   const comesBefore = n.box.bbox[0][1] < brandCandidate.bbox[0][1] - anchorSize * 0.5 || 
                                       (Math.abs(n.box.bbox[0][1] - brandCandidate.bbox[0][1]) < anchorSize * 0.5 && n.box.bbox[0][0] < brandCandidate.bbox[0][0]);
                   if (comesBefore) {
                       brandCandidate.value = n.box.text + ' ' + brandCandidate.value;
                   } else {
                       brandCandidate.value += ' ' + n.box.text;
                   }
                   brandCandidate.evidence += ' ' + n.box.text;
                   brandCandidate.bbox = computeBoundingBox([brandCandidate.bbox, n.box.bbox]);
                   brandCandidate.signals.push("multi_token_grouped");
                   break;
               }
           }
       }
   }

   // 2. Find Product
   let productCandidate = null;
   let productScore = 0;

   for (let i = 0; i < rawBoxes.length; i++) {
       const box = rawBoxes[i];
       if (brandCandidate && box.text === brandCandidate.evidence) continue;
       if (isNegativeCandidate(box.text, manufacturerName)) continue;

       let score = 0;
       const signals = [];

       const size = getFontSize(box.bbox);
       if (size > medianFontSize * 1.2) {
           score += 1;
           signals.push("prominent_text");
       }

       if (box.confidence > 0.9) {
           score += 1;
           signals.push("high_confidence");
       } else if (box.confidence < 0.6) {
           score -= 2;
       }

       if (PRODUCT_KEYWORDS.test(box.text)) {
           score += 3;
           signals.push("commodity_keyword");
       }

       if (brandCandidate) {
           const dist = computeDistance(box.bbox, brandCandidate.bbox);
           if (dist < size * 5) {
               score += 2;
               signals.push("near_brand");
           }
       }

       const neighbors = rawBoxes
         .filter(b => b !== box)
         .map(b => ({ box: b, dist: computeDistance(box.bbox, b.bbox) }))
         .filter(n => n.dist > 0 && n.dist < size * 10);

       let keywordNearbyAdded = false;
       for (const n of neighbors) {
           if (PRODUCT_LABELS.test(n.box.text)) {
               score += 5;
               signals.push("explicit_product_label_nearby");
           }
           if (!keywordNearbyAdded && PRODUCT_KEYWORDS.test(n.box.text) && n.dist < size * 6) {
               score += 1;
               signals.push("commodity_keyword_nearby");
               keywordNearbyAdded = true;
           }
       }

       if (box.text.length > 20) score -= 3;
       
       if (score >= 4 && score > productScore) {
           productScore = score;
           productCandidate = {
               value: box.text.replace(PRODUCT_LABELS, '').trim(),
               evidence: box.text,
               bbox: box.bbox,
               confidence: box.confidence,
               status: score >= 6 ? 'PASS' : 'REVIEW',
               source: 'computed',
               score,
               signals
           };
       }
   }
   
   if (productCandidate) {
       const anchorSize = getFontSize(productCandidate.bbox);
       const neighbors = rawBoxes
         .filter(b => b.text !== productCandidate.evidence && !isNegativeCandidate(b.text, manufacturerName))
         .filter(b => brandCandidate ? b.text !== brandCandidate.evidence : true)
         .map(b => ({ box: b, dist: computeDistance(productCandidate.bbox, b.bbox) }))
         .filter(n => n.dist > 0 && n.dist < anchorSize * 4)
         .sort((a,b) => a.dist - b.dist);
         
       for (const n of neighbors) {
           const nSize = getFontSize(n.box.bbox);
           if (nSize > anchorSize * 0.7 && nSize < anchorSize * 1.3) {
               if (PRODUCT_KEYWORDS.test(n.box.text) || /^[A-Za-z]+$/.test(n.box.text)) {
                   const comesBefore = n.box.bbox[0][1] < productCandidate.bbox[0][1] - anchorSize * 0.5 || 
                                       (Math.abs(n.box.bbox[0][1] - productCandidate.bbox[0][1]) < anchorSize * 0.5 && n.box.bbox[0][0] < productCandidate.bbox[0][0]);
                   if (comesBefore) {
                       productCandidate.value = n.box.text + ' ' + productCandidate.value;
                   } else {
                       productCandidate.value += ' ' + n.box.text;
                   }
                   productCandidate.evidence += ' ' + n.box.text;
                   productCandidate.bbox = computeBoundingBox([productCandidate.bbox, n.box.bbox]);
                   productCandidate.confidence = averageConfidence([productCandidate.confidence, n.box.confidence]);
                   productCandidate.signals.push("multi_token_grouped");
                   break;
               }
           }
       }
   }

   const finalBrand = brandCandidate && brandCandidate.value ? {
       value: brandCandidate.value,
       confidence: brandCandidate.confidence,
       evidence: brandCandidate.evidence,
       bbox: brandCandidate.bbox,
       source: brandCandidate.source,
       status: brandCandidate.status,
       signals: brandCandidate.signals
   } : null;

   const finalProduct = productCandidate && productCandidate.value ? {
       value: productCandidate.value,
       confidence: productCandidate.confidence,
       evidence: productCandidate.evidence,
       bbox: productCandidate.bbox,
       source: productCandidate.source,
       status: productCandidate.status,
       signals: productCandidate.signals
   } : null;

   return { brandName: finalBrand, productName: finalProduct };
}

function stripTrailingPeriod(value) {
  return value.replace(/\.+$/, '').trim()
}