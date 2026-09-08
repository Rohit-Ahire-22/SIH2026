export const DATE_LABELS = {
  dateOfManufacture: /(?:^|\W)\s*(?:date\s+of\s+manufacture|mfg(?:\.)?\s*(?:date|dt\b)|mfd(?:\.)?|manufactur(?:ed|ing)\s*(?:date|on)?)\s*[:\-.]?\s*/i,
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
    productName
  }
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

function getBoxCenter(box) {
  if (!box || box.length < 4) return [0, 0];
  const cx = (box[0][0] + box[2][0]) / 2;
  const cy = (box[0][1] + box[2][1]) / 2;
  return [cx, cy];
}

function getBoxHeight(box) {
  if (!box || box.length < 4) return 10;
  return Math.abs(box[2][1] - box[0][1]);
}

function getBoxWidth(box) {
  if (!box || box.length < 4) return 10;
  return Math.abs(box[1][0] - box[0][0]);
}

function getFontSize(box) {
  return Math.max(8, Math.min(getBoxHeight(box), getBoxWidth(box)));
}

function computeDistance(boxA, boxB) {
  if (!boxA || !boxB) return 99999;
  const [cxA, cyA] = getBoxCenter(boxA);
  const [cxB, cyB] = getBoxCenter(boxB);
  return Math.sqrt(Math.pow(cxA - cxB, 2) + Math.pow(cyA - cyB, 2));
}

function computeBoundingBox(boxes) {
  const validBoxes = boxes.filter(b => b && b.length >= 4);
  if (validBoxes.length === 0) return undefined;
  const xs = [];
  const ys = [];
  for (const box of validBoxes) {
    for (const point of box) {
      if (point && point.length >= 2) {
        xs.push(point[0]);
        ys.push(point[1]);
      }
    }
  }
  if (xs.length === 0) return undefined;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
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
      let combinedText = anchor.text.slice(labelMatch.index + labelMatch[0].length).trim();
      let valMatch = valuePattern.exec(combinedText);
      if (valMatch && (!rejectPattern || !rejectPattern.test(valMatch[1] || valMatch[2] || valMatch[3] || valMatch[0]))) {
         const extracted = valueExtractor(valMatch, anchor.text, combinedText, true);
         if (extracted) {
            candidates.push({ ...extracted, evidence: anchor.text, bbox: anchor.bbox, confidence: anchor.confidence, dist: 0 });
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
              candidates.push({ ...extracted, evidence, bbox, confidence: conf, dist: neighbor.dist });
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
                candidates.push({ ...extracted, evidence, bbox, confidence: conf, dist: neighbor.dist });
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

const REJECT_NUMBERS = /^(?:\+?91[\s.-]?)?(?:1800[\s.-]?\d{2,4}[\s.-]?\d{3,4}|\d{4}[\s.-]?\d{3}[\s.-]?\d{3}|\d{10})$|^\d{5,6}$|^\d{12,14}$|^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/

function extractMrp2D(nodes) {
  return find2DField(nodes, MRP_LABEL, MONEY_PATTERN, REJECT_NUMBERS, (match, text, combinedText, isAnchor) => {
    // If it matched the bare number group (match[3]) and it's NOT the anchor text, reject it.
    if (match[3] && !isAnchor) return null;
    
    const rawAmount = match[1] || match[2] || match[3]
    const value = parseFloat(rawAmount.replace(/,/g, ''))
    if (Number.isFinite(value)) {
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

function extractBatchLotNumber2D(nodes) {
  return find2DField(nodes, BATCH_LABEL, BATCH_VALUE, null, (match, text, combinedText) => {
    if (/see\s+(?:top|bottom|seal|pack|below|coding)/i.test(combinedText) || /see\s+(?:top|bottom|seal|pack|below|coding)/i.test(text)) {
      return { value: 'REVIEW' };
    }
    const value = stripTrailingPeriod(match[1]).trim()
    if (/[A-Za-z0-9]/.test(value)) return { value };
    return null;
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

function parseDate(raw) {
  const text = raw.trim()
  if (!text) return null
  const dmy = text.match(/(?<!\d)(0?[1-9]|[12]\d|3[01])[\s/.\-](0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4}|\d{2})(?!\d)/)
  if (dmy) {
    let year = dmy[3]
    if (year.length === 2) year = '20' + year
    return buildIsoDate(year, dmy[2], dmy[1])
  }
  const my = text.match(/(?<!\d)(0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4}|\d{2})(?!\d)/)
  if (my) {
    let year = my[2]
    if (year.length === 2) year = '20' + year
    return buildIsoDate(year, my[1], '01')
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
      if (/[A-Za-z]/.test(value)) return { value, evidence: evidenceText, bbox, confidence }
    }
  }
  return null
}

const MANUFACTURER_STOP_PATTERNS = [
  /trademark|registered|copyright|©|®|™/i,
  /based\s+on\s+lab\s+test/i,
  /po\s+box|mumbai\s*\d{6}|pin\s*\d{6}/i
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
      if (/[A-Za-z]/.test(value)) return { value, evidence: evidenceText, bbox, confidence }
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