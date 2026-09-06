export const CATEGORIES = Object.freeze([
  'food',
  'beverage',
  'cosmetic',
  'personal_care',
  'household',
  'electronics',
  'pharmaceutical',
  'agricultural',
])

export const DETECTION_STATUS = Object.freeze({
  DETECTED: 'DETECTED',
  REVIEW: 'REVIEW',
  UNKNOWN: 'UNKNOWN',
})

const WEIGHT = {
  PHRASE: 2.5,
  STRONG: 2.0,
  MEDIUM: 1.5,
  GENERIC: 1.0,
}

// Keyword priority determines the winner on an exact tie.
// Documented: "shampoo" -> cosmetic, "toothbrush" -> personal_care,
// and on a tie the earlier category in CATEGORIES wins.
const CATEGORY_KEYWORDS = {
  food: {
    phrase: [
      'nutritional information',
      'nutritional facts',
      'energy values',
      'ingredients list',
    ],
    strong: ['atta', 'pulses', 'masala', 'noodles', 'pasta', 'flour'],
    medium: [
      'biscuit',
      'biscuits',
      'snack',
      'chips',
      'rice',
      'dal',
      'spice',
      'cereal',
      'bread',
      'ingredients',
      'nutrition',
      'calories',
      'food',
    ],
    generic: [],
  },
  beverage: {
    phrase: ['mineral water', 'soft drink', 'energy drink', 'sports drink'],
    strong: ['beverage', 'soda'],
    medium: ['juice', 'drink', 'tea', 'coffee'],
    generic: ['water'],
  },
  cosmetic: {
    phrase: ['face wash', 'body lotion'],
    strong: [
      'shampoo',
      'conditioner',
      'moisturizer',
      'sunscreen',
      'lipstick',
      'foundation',
      'makeup',
      'cosmetic',
    ],
    medium: ['cream', 'lotion'],
    generic: [],
  },
  personal_care: {
    phrase: ['body wash', 'sanitary pads', 'shaving cream', 'hair oil'],
    strong: [
      'toothpaste',
      'toothbrush',
      'deodorant',
      'perfume',
      'soap',
      'razor',
      'sanitary',
    ],
    medium: [],
    generic: [],
  },
  household: {
    phrase: ['floor cleaner', 'dishwashing liquid', 'household cleaner'],
    strong: [
      'detergent',
      'cleaner',
      'dishwash',
      'dishwashing',
      'laundry',
      'disinfectant',
    ],
    medium: [],
    generic: ['household'],
  },
  electronics: {
    phrase: ['power bank', 'usb charger'],
    strong: [
      'charger',
      'adapter',
      'earphones',
      'headphones',
      'speaker',
      'laptop',
      'smartphone',
      'battery',
    ],
    medium: ['television', 'computer', 'mobile', 'electronics', 'tv'],
    generic: ['electronic'],
  },
  pharmaceutical: {
    phrase: ['prescription drug'],
    strong: [
      'tablet',
      'capsule',
      'medicine',
      'syrup',
      'dosage',
      'prescription',
      'drug',
      'pharmaceutical',
    ],
    medium: [],
    generic: [],
  },
  agricultural: {
    phrase: [],
    strong: [
      'seed',
      'seeds',
      'fertilizer',
      'pesticide',
      'insecticide',
      'herbicide',
      'agricultural',
    ],
    medium: [],
    generic: [],
  },
}

export function detectProductCategory(productInfo) {
  const sources = collectTextSources(productInfo)
  const normalized = normalizeText(sources)

  const matchesByCategory = {}
  for (const category of CATEGORIES) {
    const matches = findMatches(category, normalized)
    if (matches.length > 0) matchesByCategory[category] = matches
  }

  const scores = Object.entries(matchesByCategory).map(([category, matches]) => ({
    category,
    score: matches.reduce((sum, m) => sum + m.weight, 0),
    matchedKeywords: matches.map((m) => m.keyword),
  }))

  scores.sort(
    (a, b) =>
      b.score - a.score ||
      b.matchedKeywords.length - a.matchedKeywords.length ||
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category),
  )

  if (scores.length === 0) {
    return {
      category: 'unknown',
      confidence: 0,
      matchedKeywords: [],
      status: DETECTION_STATUS.UNKNOWN,
    }
  }

  const top = scores[0]
  const runnerUp = scores[1]

  let status = DETECTION_STATUS.DETECTED
  if (runnerUp) {
    const gap = top.score - runnerUp.score
    const similar = gap <= Math.max(top.score * 0.2, 0.0001)
    if (similar) status = DETECTION_STATUS.REVIEW
  }

  return {
    category: top.category,
    confidence: round2(top.score / (top.score + 1)),
    matchedKeywords: top.matchedKeywords,
    status,
  }
}

function collectTextSources(productInfo = {}) {
  const sources = []
  for (const key of ['productName', 'brandName', 'manufacturerName']) {
    const value = productInfo[key]
    if (typeof value === 'string' && value.trim()) sources.push(value)
  }

  const extracted = productInfo.extracted || {}
  if (typeof extracted.countryOfOrigin === 'string') {
    sources.push(extracted.countryOfOrigin)
  }
  if (typeof extracted.manufacturerName === 'string') {
    sources.push(extracted.manufacturerName)
  }

  const ocrResults = productInfo.ocrResults || productInfo.ocrText
  if (Array.isArray(ocrResults)) {
    for (const entry of ocrResults) {
      const line =
        typeof entry === 'string'
          ? entry
          : entry && typeof entry.text === 'string'
            ? entry.text
            : ''
      if (line.trim()) sources.push(line)
    }
  } else if (typeof ocrResults === 'string' && ocrResults.trim()) {
    sources.push(ocrResults)
  }

  return sources
}

function normalizeText(sources) {
  return sources
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function findMatches(category, normalizedText) {
  const matches = []
  const groups = CATEGORY_KEYWORDS[category]

  for (const [groupName, keywords] of Object.entries(groups)) {
    const weight = WEIGHT[groupName.toUpperCase()]
    for (const keyword of keywords) {
      if (keywordRegex(keyword).test(normalizedText)) {
        matches.push({ keyword, weight })
      }
    }
  }
  return matches
}

function keywordRegex(keyword) {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function round2(value) {
  return Math.round(value * 100) / 100
}