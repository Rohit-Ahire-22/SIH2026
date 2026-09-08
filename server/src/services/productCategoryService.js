export const CATEGORIES = Object.freeze([
  'food',
  'beverage',
  'cosmetic',
  'personal_care',
  'household',
  'electronics',
  'pharmaceutical',
  'agricultural',
  'other',
  'unknown'
])

export const DETECTION_STATUS = Object.freeze({
  DETECTED: 'DETECTED',
  REVIEW: 'REVIEW',
  UNKNOWN: 'UNKNOWN',
})

const EXPLICIT_SIGNALS = {
  food: [/\bfssai\b/i, /\bfood safety\b/i, /\bdietary supplement\b/i, /\bproprietary food\b/i, /\bhealth supplement\b/i],
  beverage: [/\bfssai\b/i, /\bpackaged drinking water\b/i, /\bsweetened beverage\b/i, /\bcarbonated water\b/i],
  cosmetic: [/\bcosmetic product\b/i, /\btoiletries\b/i, /\bfor cosmetic use\b/i],
  pharmaceutical: [/\bayurvedic medicine\b/i, /\bprescription drug\b/i, /\bschedule h\b/i, /\bpharmacopoeia\b/i, /\brx only\b/i]
}

const PACKAGING_SIGNALS = {
  food: [/\bnutritional information\b/i, /\bnutrition facts\b/i, /\bcalories\b/i, /\bprotein\b/i, /\bcarbohydrate\b/i, /\bfat\b/i, /\bingredients\b/i, /\bbest before\b/i, /\buse by\b/i, /\btrans fat\b/i],
  beverage: [/\bnutritional information\b/i, /\bnutrition facts\b/i, /\bcalories\b/i, /\badded sugar\b/i],
  cosmetic: [/\bfor external use only\b/i, /\bavoid contact with eyes\b/i, /\bdirections for use\b/i, /\bpatch test\b/i, /\bdermatologically tested\b/i],
  personal_care: [/\bfor external use only\b/i, /\bavoid contact with eyes\b/i, /\bdirections for use\b/i, /\bpatch test\b/i],
  pharmaceutical: [/\bfor external use only\b/i, /\bdosage\b/i, /\bphysician\b/i, /\bkeep out of reach of children\b/i, /\bstore in a cool dry place\b/i],
  household: [/\bkeep out of reach of children\b/i, /\bfor external use only\b/i, /\bharmful if swallowed\b/i, /\bcorrosive\b/i, /\bcaution:\b/i],
  electronics: [/\binput 100-240v\b/i, /\bac adapter\b/i, /\bpower consumption\b/i, /\bwattage\b/i, /\bvoltage\b/i, /\bhz\b/i, /\bwarranty\b/i]
}

const SEMANTIC_PRODUCT_NAME = {
  food: [/\bbiscuits?\b/i, /\bchips\b/i, /\bsnack\b/i, /\bmasala\b/i, /\batta\b/i, /\bnoodles\b/i, /\bpasta\b/i, /\bflour\b/i, /\brice\b/i, /\bdal\b/i, /\bspice\b/i, /\bcereal\b/i, /\bbread\b/i],
  beverage: [/\bjuice\b/i, /\bdrink\b/i, /\bwater\b/i, /\bsoda\b/i, /\btea\b/i, /\bcoffee\b/i],
  cosmetic: [/\bshampoo\b/i, /\blotion\b/i, /\bcream\b/i, /\blipstick\b/i, /\bmakeup\b/i, /\bmoisturizer\b/i, /\bfoundation\b/i, /\bsunscreen\b/i, /\bconditioner\b/i],
  personal_care: [/\btoothbrush\b/i, /\btoothpaste\b/i, /\bsoap\b/i, /\bdeodorant\b/i, /\bperfume\b/i, /\brazor\b/i, /\bsanitary\b/i, /\bbody wash\b/i, /\bhair oil\b/i],
  household: [/\bsurface cleaner\b/i, /\bfloor cleaner\b/i, /\bhousehold cleaner\b/i, /\bdetergent\b/i, /\bcleaner\b/i, /\bdishwash\b/i, /\blaundry\b/i, /\bdisinfectant\b/i, /\bphenyl\b/i],
  electronics: [/\bcharger\b/i, /\badapter\b/i, /\bearphones\b/i, /\bheadphones\b/i, /\bspeaker\b/i, /\blaptop\b/i, /\bsmartphone\b/i, /\bbattery\b/i, /\bpower bank\b/i],
  pharmaceutical: [/\btablet\b/i, /\bcapsule\b/i, /\bmedicine\b/i, /\bsyrup\b/i, /\bointment\b/i],
  agricultural: [/\bseed\b/i, /\bfertilizer\b/i, /\bpesticide\b/i, /\binsecticide\b/i, /\bherbicide\b/i]
}

const GENERAL_OCR_CONTEXT = {
  food: [/\bfood\b/i, /\beat\b/i, /\bdelicious\b/i, /\btaste\b/i, /\bsnack\b/i, /\bnutrition\b/i, /\bbiscuits?\b/i, /\bchips\b/i, /\bmasala\b/i, /\bspice\b/i],
  beverage: [/\bdrink\b/i, /\bthirst\b/i, /\brefreshing\b/i, /\bliquid\b/i, /\bjuice\b/i, /\bwater\b/i, /\bsoda\b/i, /\btea\b/i, /\bcoffee\b/i],
  cosmetic: [/\bskin\b/i, /\bhair\b/i, /\bbeauty\b/i, /\bglow\b/i, /\bshine\b/i, /\bcomplexion\b/i, /\bshampoo\b/i, /\blotion\b/i, /\bcream\b/i],
  personal_care: [/\bhygiene\b/i, /\bclean\b/i, /\bfresh\b/i, /\bcare\b/i, /\bsoap\b/i, /\btoothpaste\b/i],
  household: [/\bclean\b/i, /\bwash\b/i, /\bstain\b/i, /\bdirt\b/i, /\bfloor\b/i, /\bsurface\b/i, /\bhome\b/i, /\blaundry\b/i, /\bdetergent\b/i, /\bcleaner\b/i],
  electronics: [/\bdevice\b/i, /\bpower\b/i, /\bcharge\b/i, /\belectronic\b/i, /\badapter\b/i, /\bcharger\b/i],
  pharmaceutical: [/\bhealth\b/i, /\brelief\b/i, /\bpain\b/i, /\bcure\b/i, /\bdoctor\b/i, /\btablets?\b/i, /\bcapsules?\b/i, /\bsyrup\b/i],
  agricultural: [/\bcrop\b/i, /\bfarm\b/i, /\byield\b/i, /\bplant\b/i, /\bseed\b/i, /\bfertilizer\b/i]
}

const NEGATIVE_SIGNALS = {
  food: [/\bnot for human consumption\b/i, /\bfor external use only\b/i, /\bpoison\b/i, /\bdo not swallow\b/i],
  beverage: [/\bnot for human consumption\b/i, /\bfor external use only\b/i, /\bpoison\b/i, /\bdo not swallow\b/i],
  cosmetic: [/\bnot for human consumption\b/i, /\bpoison\b/i, /\bdo not apply on skin\b/i]
}

const FIELD_SIGNALS = {
  food: { unit: ['g', 'kg'] },
  beverage: { unit: ['ml', 'l', 'liter'] },
  cosmetic: { unit: ['ml', 'g', 'oz'] },
  household: { unit: ['ml', 'l', 'kg', 'g'] },
  electronics: { unit: ['units', 'n', 'u'] },
  pharmaceutical: { unit: ['mg', 'ml', 'tablets', 'capsules'] }
}

export function detectProductCategory(productInfo) {
  const scores = {};
  const detailedSignals = [];
  
  CATEGORIES.forEach(c => scores[c] = 0);

  const fullOcrText = collectOcrText(productInfo);
  const productName = productInfo.productName || productInfo.extracted?.productName?.value || '';
  const brandName = productInfo.brandName || productInfo.extracted?.brandName?.value || '';
  const netQuantityUnit = productInfo.netQuantity?.unit || productInfo.extracted?.netQuantity?.unit || '';

  const addSignal = (category, layer, signal, weight, sourceText = '') => {
      scores[category] += weight;
      detailedSignals.push({
          category,
          layer,
          signal,
          weight,
          sourceText
      });
  };

  // 1. Explicit Signals (Weight: +10)
  Object.entries(EXPLICIT_SIGNALS).forEach(([category, patterns]) => {
     patterns.forEach(regex => {
        const match = fullOcrText.match(regex);
        if (match) {
            addSignal(category, 'EXPLICIT_REGULATORY', match[0].toLowerCase(), 10, match[0]);
        }
     });
  });

  // 2. Packaging Signals (Weight: +6)
  Object.entries(PACKAGING_SIGNALS).forEach(([category, patterns]) => {
     patterns.forEach(regex => {
        const match = fullOcrText.match(regex);
        if (match) {
            addSignal(category, 'PACKAGING_DECLARATION', match[0].toLowerCase(), 6, match[0]);
        }
     });
  });

  // 3. Semantic Product Name (Weight: +5)
  const nameText = (productName + " " + brandName).trim().toLowerCase();
  if (nameText) {
      Object.entries(SEMANTIC_PRODUCT_NAME).forEach(([category, patterns]) => {
         patterns.forEach(regex => {
            const match = nameText.match(regex);
            if (match) {
                addSignal(category, 'SEMANTIC_PRODUCT_NAME', match[0].toLowerCase(), 5, match[0]);
            }
         });
      });
  }

  // 4. General OCR Context (Weight: +2)
  Object.entries(GENERAL_OCR_CONTEXT).forEach(([category, patterns]) => {
     patterns.forEach(regex => {
        const match = fullOcrText.match(regex);
        if (match) {
            addSignal(category, 'GENERAL_OCR_CONTEXT', match[0].toLowerCase(), 2, match[0]);
        }
     });
  });

  // 5. Extracted Field Signals (Weight: +1)
  if (netQuantityUnit) {
      const u = netQuantityUnit.toLowerCase();
      Object.entries(FIELD_SIGNALS).forEach(([category, data]) => {
          if (data.unit.includes(u)) {
              addSignal(category, 'EXTRACTED_FIELD', u, 1, netQuantityUnit);
          }
      });
  }

  // 6. Negative Signals (Penalty: -15)
  Object.entries(NEGATIVE_SIGNALS).forEach(([category, patterns]) => {
     patterns.forEach(regex => {
        const match = fullOcrText.match(regex);
        if (match) {
            addSignal(category, 'NEGATIVE_SIGNAL', "!" + match[0].toLowerCase(), -15, match[0]);
        }
     });
  });

  // Collect results
  const ranked = Object.entries(scores)
      .map(([category, score]) => ({ category, score }))
      .sort((a, b) => b.score - a.score || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));

  const top = ranked[0];
  const runnerUp = ranked[1];

  let status = DETECTION_STATUS.UNKNOWN;
  let confidence = 0;

  if (top.score >= 8) {
     if (top.score >= runnerUp.score * 1.5 || (top.score - runnerUp.score >= 5)) {
         status = DETECTION_STATUS.DETECTED;
         confidence = Math.min(0.8 + (top.score / 50), 0.99);
     } else {
         status = DETECTION_STATUS.REVIEW;
         confidence = Math.min(0.4 + (top.score / 30), 0.79);
     }
  } else if (top.score >= 4) {
     status = DETECTION_STATUS.REVIEW;
     confidence = Math.min(0.4 + (top.score / 30), 0.79);
  } else {
     status = DETECTION_STATUS.UNKNOWN;
     confidence = 0;
  }

  const winningSignals = detailedSignals.filter(s => s.category === top.category);

  if (status === DETECTION_STATUS.UNKNOWN) {
      return {
          category: 'unknown',
          confidence: 0,
          status,
          evidence: [],
          matchedSignals: detailedSignals
      };
  }

  return {
      category: top.category,
      confidence: Number(confidence.toFixed(2)),
      status,
      evidence: Array.from(new Set(winningSignals.map(s => s.layer))),
      matchedSignals: winningSignals
  };
}

function collectOcrText(productInfo) {
  let text = '';
  const ocrResults = productInfo.ocrResults || productInfo.ocrText;
  if (Array.isArray(ocrResults)) {
    for (const entry of ocrResults) {
      if (typeof entry === 'string') text += entry + '\n';
      else if (entry && typeof entry.text === 'string') text += entry.text + '\n';
      else if (entry && entry.results) {
        for (const r of entry.results) {
           text += (r.text || '') + '\n';
        }
      }
    }
  } else if (typeof ocrResults === 'string') {
    text = ocrResults;
  }
  return text.toLowerCase();
}