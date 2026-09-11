/**
 * Nutrition Recommendation Service
 *
 * Suggests 3–5 packaged-product alternatives to a scanned nutrition label
 * using the Open Food Facts API (open database). All logic is GENERALISED —
 * no hardcoded brands or retail products.
 *
 * Design rules:
 *  - Only per-100 g / per-100 ml declarations are compared (same basis).
 *  - Comparisons are limited to nutrients that exist on BOTH sides.
 *  - "Better" is multi-factor and category-aware: each category defines
 *    which nutrients matter and whether lower or higher is preferable.
 *  - We never fabricate values, percentages, or medical claims.
 *  - External API failures degrade to graceful empty states.
 *
 * Environment:
 *   NUTRITION_OFF_BASE_URL — Open Food Facts host (optional, default world.openfoodfacts.org)
 *   NUTRITION_OFF_TIMEOUT_MS — per-request timeout (default 12000)
 */

const OFF_BASE = process.env.NUTRITION_OFF_BASE_URL || 'https://world.openfoodfacts.org'
const OFF_TIMEOUT_MS = Number(process.env.NUTRITION_OFF_TIMEOUT_MS) || 12000
const USER_AGENT = 'PackagedCommodityComplianceSIH26034/1.0 (SIH2026 prototype)'

// Small in-memory TTL cache for external search results — avoids hammering the
// Open Food Facts rate limit when the same category is requested repeatedly
// (e.g. the user re-triggers "Find Better Options" or reopens the page).
const SEARCH_CACHE_TTL_MS = Number(process.env.NUTRITION_OFF_CACHE_TTL_MS) || 10 * 60 * 1000
const searchCache = new Map() // key -> { expiresAt, value }

function cachedSearch(key, fn) {
  const hit = searchCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value)
  return Promise.resolve(fn()).then((value) => {
    searchCache.set(key, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, value })
    return value
  })
}

export function _clearSearchCache() {
  searchCache.clear()
}

// Canonical nutrient keys used internally (all per 100 g / per 100 ml).
export const NUTRIENT_UNITS = {
  energy: 'kcal',
  protein: 'g',
  totalFat: 'g',
  saturatedFat: 'g',
  transFat: 'g',
  carbohydrates: 'g',
  sugars: 'g',
  fibre: 'g',
  sodium: 'mg',
}

/**
 * Category-aware priority profiles.
 * direction: 'lower' means a smaller value is preferable for that nutrient,
 *            'higher' means a larger value is preferable.
 */
export const CATEGORY_PROFILES = {
  breakfast_cereals: {
    label: 'Breakfast Cereals',
    priorities: {
      sugars: { weight: 0.3, direction: 'lower' },
      fibre: { weight: 0.3, direction: 'higher' },
      energy: { weight: 0.2, direction: 'lower' },
      sodium: { weight: 0.2, direction: 'lower' },
    },
  },
  biscuits: {
    label: 'Biscuits',
    priorities: {
      sugars: { weight: 0.3, direction: 'lower' },
      saturatedFat: { weight: 0.3, direction: 'lower' },
      energy: { weight: 0.2, direction: 'lower' },
      totalFat: { weight: 0.2, direction: 'lower' },
    },
  },
  snacks: {
    label: 'Snacks',
    priorities: {
      totalFat: { weight: 0.3, direction: 'lower' },
      sodium: { weight: 0.25, direction: 'lower' },
      energy: { weight: 0.2, direction: 'lower' },
      saturatedFat: { weight: 0.15, direction: 'lower' },
      sugars: { weight: 0.1, direction: 'lower' },
    },
  },
  beverages: {
    label: 'Beverages',
    priorities: {
      sugars: { weight: 0.5, direction: 'lower' },
      energy: { weight: 0.3, direction: 'lower' },
      sodium: { weight: 0.2, direction: 'lower' },
    },
  },
  milk_dairy: {
    label: 'Milk & Dairy',
    priorities: {
      saturatedFat: { weight: 0.35, direction: 'lower' },
      sugars: { weight: 0.3, direction: 'lower' },
      protein: { weight: 0.2, direction: 'higher' },
      sodium: { weight: 0.15, direction: 'lower' },
    },
  },
  chocolate_confectionery: {
    label: 'Chocolate & Confectionery',
    priorities: {
      sugars: { weight: 0.4, direction: 'lower' },
      saturatedFat: { weight: 0.35, direction: 'lower' },
      energy: { weight: 0.25, direction: 'lower' },
    },
  },
  bakery_bread: {
    label: 'Bread & Bakery',
    priorities: {
      sodium: { weight: 0.35, direction: 'lower' },
      fibre: { weight: 0.25, direction: 'higher' },
      sugars: { weight: 0.2, direction: 'lower' },
      saturatedFat: { weight: 0.2, direction: 'lower' },
    },
  },
  noodles_pasta: {
    label: 'Noodles & Pasta',
    priorities: {
      sodium: { weight: 0.4, direction: 'lower' },
      saturatedFat: { weight: 0.3, direction: 'lower' },
      energy: { weight: 0.2, direction: 'lower' },
      protein: { weight: 0.1, direction: 'higher' },
    },
  },
  sauces: {
    label: 'Sauces & Dressings',
    priorities: {
      sugars: { weight: 0.35, direction: 'lower' },
      sodium: { weight: 0.3, direction: 'lower' },
      totalFat: { weight: 0.2, direction: 'lower' },
      saturatedFat: { weight: 0.15, direction: 'lower' },
    },
  },
  canned_preserved: {
    label: 'Canned & Preserved Foods',
    priorities: {
      sodium: { weight: 0.45, direction: 'lower' },
      sugars: { weight: 0.25, direction: 'lower' },
      energy: { weight: 0.15, direction: 'lower' },
      totalFat: { weight: 0.15, direction: 'lower' },
    },
  },
  edible_oils: {
    label: 'Edible Oils & Fats',
    priorities: {
      saturatedFat: { weight: 0.55, direction: 'lower' },
      energy: { weight: 0.25, direction: 'lower' },
      sodium: { weight: 0.2, direction: 'lower' },
    },
  },
  frozen_convenience: {
    label: 'Frozen & Ready-to-Eat',
    priorities: {
      sodium: { weight: 0.35, direction: 'lower' },
      saturatedFat: { weight: 0.25, direction: 'lower' },
      energy: { weight: 0.2, direction: 'lower' },
      sugars: { weight: 0.2, direction: 'lower' },
    },
  },
  icecream: {
    label: 'Ice Cream & Frozen Desserts',
    priorities: {
      sugars: { weight: 0.45, direction: 'lower' },
      saturatedFat: { weight: 0.3, direction: 'lower' },
      energy: { weight: 0.25, direction: 'lower' },
    },
  },
  unspecified: {
    label: 'General Packaged Foods',
    priorities: {
      sugars: { weight: 0.3, direction: 'lower' },
      saturatedFat: { weight: 0.25, direction: 'lower' },
      sodium: { weight: 0.25, direction: 'lower' },
      energy: { weight: 0.2, direction: 'lower' },
    },
  },
}

// Keyword → category detection (compared case-insensitively against
// label text and OCR raw text). Ordered so more specific terms win.
const CATEGORY_KEYWORDS = [
  { key: 'breakfast_cereals', terms: ['breakfast', 'cereal', 'muesli', 'müsli', 'oatmeal', 'porridge', 'cornflakes', 'corn flakes', 'oats'] },
  { key: 'biscuits', terms: ['biscuit', 'cookie', 'cookies', 'rusk', 'digestive', 'cream cracker'] },
  { key: 'snacks', terms: ['namkeen', 'bhujia', 'chips', 'wafers', 'crisps', 'snack', 'nachos', 'popcorn', 'chanachur', 'mixture', 'samosa', 'sev'] },
  { key: 'beverages', terms: ['beverage', 'juice', 'cola', 'soda', 'carbonated', 'squash', 'sherbet', 'drink', 'iced tea', 'lemonade', 'energy drink'] },
  { key: 'milk_dairy', terms: ['milk', 'curd', 'yogurt', 'yoghurt', 'paneer', 'cheese', 'cream', 'lassi', 'buttermilk'] },
  { key: 'chocolate_confectionery', terms: ['chocolate', 'candy', 'toffee', 'lollipop', 'confectionery', 'bonbon'] },
  { key: 'bakery_bread', terms: ['bread', 'loaf', 'bun', 'pav', 'croissant', 'baguette', 'cake', 'pastry'] },
  { key: 'noodles_pasta', terms: ['noodle', 'noodles', 'pasta', 'macaroni', 'spaghetti', 'vermicelli', 'maggi' ] },
  { key: 'sauces', terms: ['sauce', 'ketchup', 'chutney', 'dressing', 'mayonnaise', 'pickle', 'paste'] },
  { key: 'canned_preserved', terms: ['canned', 'tinned', 'preserved', 'jam', 'marmalade'] },
  { key: 'edible_oils', terms: ['oil', 'ghee', 'butter', 'cooking oil', 'vanaspati'] },
  { key: 'frozen_convenience', terms: ['frozen', 'ready to eat', 'instant', 'microwave'] },
  { key: 'icecream', terms: ['ice cream', 'icecream', 'kulfi', 'frozen dessert', 'sorbet'] },
]

// Confidence map: how many keyword groups matched for a category.
function matchStrength(text) {
  const lower = ` ${String(text || '').toLowerCase()} `
  const hits = []
  for (const group of CATEGORY_KEYWORDS) {
    const found = group.terms.filter((t) => lower.includes(` ${t} `) || lower.includes(` ${t}.`) || lower.includes(` ${t},`))
    if (found.length > 0) hits.push({ key: group.key, terms: found })
  }
  // Order by number of matched terms, most specific first.
  hits.sort((a, b) => b.terms.length - a.terms.length)
  return hits
}

/**
 * Detects a product category from label + OCR text.
 * Pure function — unit-tested without network access.
 *
 * @param {string} text - label text and/or OCR raw text (combined)
 * @returns {{ key: string, label: string, confidence: number, keywordsFound: string[] }}
 */
export function detectCategory(text) {
  const hits = matchStrength(text)
  if (hits.length === 0) {
    const profile = CATEGORY_PROFILES.unspecified
    return { key: 'unspecified', label: profile.label, confidence: 0, keywordsFound: [] }
  }
  const top = hits[0]
  const confidence = Math.min(0.95, 0.5 + top.terms.length * 0.15)
  const profile = CATEGORY_PROFILES[top.key]
  return {
    key: top.key,
    label: profile ? profile.label : CATEGORY_PROFILES.unspecified.label,
    confidence: Math.round(confidence * 100) / 100,
    keywordsFound: top.terms,
  }
}

// Open Food Facts category tag for structured search (v2 /api/v2/search).
// Only tags we are confident exist in the OFF taxonomy are mapped;
// anything else falls back to keyword-based (legacy) search.
export const OFF_CATEGORY_TAGS = {
  breakfast_cereals: 'en:breakfast-cereals',
  biscuits: 'en:biscuits-and-cakes',
  snacks: 'en:salty-snacks',
  beverages: 'en:beverages',
  chocolate_confectionery: 'en:chocolates',
  bakery_bread: 'en:bread',
  noodles_pasta: 'en:noodles',
  sauces: 'en:sauces',
  edible_oils: 'en:vegetable-oils',
  milk_dairy: 'en:milks',
  canned_preserved: 'en:canned-foods',
  icecream: 'en:ice-creams-and-sorbets',
}

/**
 * Normalises a scanned nutrient list into canonical per-100 values.
 * Only reads nutrients that are comparable to external per-100 data.
 * Pure function.
 *
 * @param {Array<{name:string, value:number|null, unit:string|null}>} nutrients
 * @returns {object|null} canonical map or null when no usable nutrients
 */
export function normalizeScannedNutrients(nutrients) {
  if (!Array.isArray(nutrients) || nutrients.length === 0) return null
  const out = {}
  const row = (name) => nutrients.find((n) => n && n.name && n.name.toLowerCase() === name)

  const energy = row('energy')
  if (energy && energy.value !== null && energy.value !== undefined && Number.isFinite(energy.value)) {
    const unit = String(energy.unit || 'kcal').toLowerCase()
    out.energy = unit === 'kj' ? round1(energy.value / 4.184) : round1(energy.value)
  }

  const pick = (name, key) => {
    const r = row(name)
    if (r && r.value !== null && r.value !== undefined && Number.isFinite(r.value)) {
      out[key] = round1(r.value)
    }
  }
  pick('protein', 'protein')
  pick('total fat', 'totalFat')
  pick('saturated fat', 'saturatedFat')
  pick('trans fat', 'transFat')
  pick('carbohydrates', 'carbohydrates')
  pick('total sugars', 'sugars')
  pick('dietary fibre', 'fibre')
  pick('sodium', 'sodium')

  return Object.keys(out).length > 0 ? out : null
}

/**
 * Normalises Open Food Facts `nutriments` into canonical per-100 values.
 * Pure function (accepts real OFF field names).
 *
 * @param {object} nutriments - e.g. { energy-kcal_100g: 400, sugars_100g: 5, ... }
 * @returns {object} canonical map
 */
export function normalizeNutriments(nutriments) {
  const out = {}
  if (!nutriments || typeof nutriments !== 'object') return out

  const num = (base) => (Number.isFinite(Number(nutriments[base])) ? Number(nutriments[base]) : undefined)

  // Read per-100 g first, fall back to per-100 ml (liquids on OFF declare
  // *_100mL only). `per100` on the candidate records which basis applied so
  // comparisons stay on the same basis.
  const energyKcal = num('energy-kcal_100g') ?? num('energy-kcal_100mL')
  const energyKj = num('energy_100g') ?? num('energy_100mL')
  if (energyKcal !== undefined) out.energy = round1(energyKcal)
  else if (energyKj !== undefined) out.energy = round1(energyKj / 4.184)

  const scalar = (key, field) => {
    const v = num(`${field}_100g`) ?? num(`${field}_100mL`)
    if (v !== undefined) out[key] = round1(v)
  }
  scalar('protein', 'proteins')
  scalar('totalFat', 'fat')
  scalar('saturatedFat', 'saturated-fat')
  scalar('transFat', 'trans-fat')
  scalar('carbohydrates', 'carbohydrates')
  scalar('sugars', 'sugars')
  scalar('fibre', 'fiber')

  const sodium = num('sodium_100g') ?? num('sodium_100mL')
  const salt = num('salt_100g') ?? num('salt_100mL')
  if (sodium !== undefined) out.sodium = round1(sodium)
  else if (salt !== undefined) out.sodium = round1(salt * 400)

  return out
}

function round1(v) {
  return Math.round(v * 10) / 10
}

function fmt(v) {
  if (v === undefined || v === null) return null
  return Number.isInteger(v) ? v : Math.round(v * 10) / 10
}

const NUTRIENT_LABELS = {
  energy: 'Energy',
  protein: 'Protein',
  totalFat: 'Total fat',
  saturatedFat: 'Saturated fat',
  transFat: 'Trans fat',
  carbohydrates: 'Carbohydrates',
  sugars: 'Sugars',
  fibre: 'Dietary fibre',
  sodium: 'Sodium',
}

/**
 * Ranks normalised candidate products against the scanned product using a
 * category-aware profile. Pure function — unit-tested without network.
 *
 * @param {object} scanned - canonical scanned values
 * @param {string} categoryKey - from CATEGORY_PROFILES
 * @param {Array<object>} candidates - [{ id, name, brand, quantity, imageUrl, productUrl, values, nutrientLevels, novaGroup }]
 * @returns {object} { status, recommendations, scannedIsCompetitive, noComparableData }
 */
export function scoreCandidates(scanned, categoryKey, candidates) {
  const profile = CATEGORY_PROFILES[categoryKey] || CATEGORY_PROFILES.unspecified
  const priorities = profile.priorities
  const keys = Object.keys(priorities)

  const usable = (candidates || []).filter((c) => c && c.name && typeof c.values === 'object' && c.values)

  const scored = usable
    .map((cand) => {
      // coverage = number of profile nutrients present on BOTH sides and
      // with a positive scanned baseline (so a relative change is meaningful).
      const covered = keys.filter((k) =>
        scanned[k] !== undefined && scanned[k] !== null && scanned[k] > 0 &&
        cand.values[k] !== undefined && cand.values[k] !== null,
      )

      if (covered.length === 0) return null

      let weighted = 0
      const deltas = [] // improvement entries for explanations
      for (const k of covered) {
        const p = priorities[k]
        const scan = scanned[k]
        const candVal = cand.values[k]
        let delta = (scan - candVal) / scan
        if (p.direction === 'higher') delta = (candVal - scan) / scan
        delta = Math.max(-1, Math.min(1, delta))
        weighted += p.weight * delta
        deltas.push({ key: k, delta })
      }

      const weightTotal = covered.reduce((s, k) => s + (priorities[k] ? priorities[k].weight : 0), 0)
      const score = weightTotal > 0 ? weighted / weightTotal : 0

      // Reasons: biggest positive improvements, with the actual numbers.
      const improved = deltas
        .filter((d) => d.delta >= 0.15)
        .sort((a, b) => b.delta - a.delta)

      const reasons = improved
        .slice(0, 3)
        .map((d) => {
          const label = NUTRIENT_LABELS[d.key]
          const unit = NUTRIENT_UNITS[d.key]
          const pct = Math.round(d.delta * 100)
          return `${pct}% lower ${label.toLowerCase()} (${fmt(cand.values[d.key])} ${unit} vs ${fmt(scanned[d.key])} ${unit} per 100 ${cand.per100 || 'g'})`
        })

      // Advantages: narrative "why we recommended it", in the correct
      // direction (higher is better for protein/fibre, lower otherwise).
      const advantages = improved
        .slice(0, 3)
        .map((d) => {
          const p = priorities[d.key]
          const label = NUTRIENT_LABELS[d.key]
          const pct = Math.round(d.delta * 100)
          const verb = p.direction === 'higher' ? 'higher' : 'lower'
          return `${label} is ${pct}% ${verb} than the scanned product (${fmt(cand.values[d.key])} ${NUTRIENT_UNITS[d.key]} per 100 ${cand.per100 || 'g'})`
        })

      // Limitations: profile nutrients the candidate did not declare.
      const limitations = keys
        .filter((k) => cand.values[k] === undefined || cand.values[k] === null)
        .map((k) => `${NUTRIENT_LABELS[k]} is not declared for this product, so it was not compared.`)
      if (cand.per100) {
        limitations.push(`Values compare on a per-100 ${cand.per100} basis as declared on the labels.`)
      }

      return {
        ...cand,
        score: Math.round(score * 1000) / 1000,
        coverage: covered.length,
        reasons,
        advantages,
        limitations,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  const eligible = scored.filter((c) => c.score > 0.02)

  let status
  let recommendations
  let scannedIsCompetitive = false
  let noComparableData = false

  if (eligible.length > 0) {
    status = 'recommendations'
    recommendations = eligible.slice(0, 5).map((c, i) => ({
      rank: i + 1,
      name: c.name,
      brand: c.brand,
      category: profile.label,
      source: 'Open Food Facts',
      sourceUrl: c.productUrl || null,
      quantity: c.quantity,
      imageUrl: c.imageUrl,
      productUrl: c.productUrl,
      score: c.score,
      coverage: c.coverage,
      dataCompleteness: Math.round((c.coverage / Math.max(1, Object.keys(priorities).length)) * 100) / 100,
      values: c.values,
      reasons: c.reasons,
      advantages: c.advantages,
      limitations: c.limitations,
      nutrientLevels: c.nutrientLevels || null,
      novaGroup: c.novaGroup || null,
    }))
  } else if (scored.length > 0) {
    status = 'scanned_competitive'
    scannedIsCompetitive = true
    recommendations = []
  } else {
    status = 'no_comparable_products'
    noComparableData = true
    recommendations = []
  }

  return { status, recommendations, scannedIsCompetitive, noComparableData }
}

/**
 * Searches Open Food Facts for candidate products in the same category.
 * Network-backed; callers must tolerate failures (graceful empty state).
 *
 * @param {string} categoryKey
 * @param {string} searchText - reserved for future free-text search; the current
 *   implementation searches by OFF category tag only.
 * @returns {Promise<Array<object>>} normalised candidates
 */
export async function searchSimilarProducts(categoryKey, searchText) {
  const cacheKey = `${categoryKey}::${String(searchText || '').trim()}`
  return cachedSearch(cacheKey, async () => {
    const tag = OFF_CATEGORY_TAGS[categoryKey]
    let products = []
    if (tag) {
      products = await structuredSearch(tag)
    }
    return normalizeOfficialCandidates(products)
  })
}

async function structuredSearch(categoryTag) {
  const params = new URLSearchParams({
    categories_tags: categoryTag,
    page_size: String(40),
    fields: 'code,product_name,brands,quantity,image_front_url,nutriments,nutrient_levels,nova_group,serving_size',
    json: '1',
  })
  return getJson(`/api/v2/search?${params.toString()}`)
    .then((data) => data.products || [])
    .catch((err) => {
      console.warn('[NutritionRec] structured search failed:', err.message)
      return []
    })
}

const RETRY_LIMIT = 3
const RETRY_DELAYS_MS = [0, 500, 1000]

function isNonRetryableStatus(status) {
  return status >= 400 && status < 500 && status !== 429
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getJson(path) {
  let lastError
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAYS_MS[attempt])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS)
    try {
      const res = await fetch(`${OFF_BASE}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res.ok) return await res.json()
      await res.text().catch(() => {})
      if (isNonRetryableStatus(res.status)) {
        const err = new Error(`Open Food Facts HTTP ${res.status}`)
        err.status = res.status
        throw err
      }
      lastError = new Error(`Open Food Facts HTTP ${res.status}`)
    } catch (err) {
      clearTimeout(timer)
      if (isNonRetryableStatus(err.status)) throw err
      lastError = err
    }
  }
  throw lastError
}

/**
 * Converts raw OFF product objects into the canonical candidate shape used
 * by scoreCandidates. Public for tests.
 */
export function normalizeOfficialCandidates(products) {
  const limited = (products || []).slice(0, 40)
  const out = []
  for (const p of limited) {
    if (!p || !p.product_name) continue
    const values = normalizeNutriments(p.nutriments)
    // Skip products with no usable nutrient data at all.
    if (Object.keys(values).length === 0) continue

    const nutr = p.nutriments || {}
    const hasMlBasis = Object.keys(nutr).some((k) => /_100ml$/i.test(k))

    out.push({
      id: p.code || null,
      name: p.product_name,
      brand: p.brands || null,
      quantity: p.quantity || null,
      imageUrl: p.image_front_url || null,
      productUrl: p.code ? `https://world.openfoodfacts.org/product/${p.code}` : null,
      values,
      per100: hasMlBasis ? 'ml' : 'g',
      nutrientLevels: p.nutrient_levels || null,
      novaGroup: p.nova_group ? Number(p.nova_group) : null,
    })
  }
  return out
}

/**
 * Full orchestration: detect category → search → normalise → score → rank.
 * `options.searchFn` can be injected in tests to avoid network access.
 *
 * @param {Array<object>} nutrients - scanned nutrients
 * @param {string} label - optional product label text
 * @param {string} rawText - optional OCR raw text
 * @param {object} options - { searchFn }
 * @returns {Promise<object>} recommendation result object
 */
export async function buildRecommendations(nutrients, label, rawText, options = {}) {
  const text = `${label || ''} ${rawText || ''}`.trim()
  const category = detectCategory(text)
  const lowCategoryConfidence = category.confidence < 0.5
  const scanned = normalizeScannedNutrients(nutrients)

  if (!scanned) {
    return {
      category,
      lowCategoryConfidence,
      status: 'no_comparable_products',
      noComparableData: true,
      scannedIsCompetitive: false,
      recommendations: [],
      reason: 'No usable nutrients were extracted from the scanned label.',
    }
  }

  const searchFn = typeof options.searchFn === 'function' ? options.searchFn : searchSimilarProducts

  let candidates = []
  try {
    candidates = await searchFn(category.key, text)
  } catch (err) {
    console.warn('[NutritionRec] recommendation pipeline error:', err.message)
    candidates = []
  }

  const result = scoreCandidates(scanned, category.key, candidates)
  return {
    category,
    lowCategoryConfidence,
    ...result,
    disclaimer:
      'Recommendations are based on nutritional comparison (per 100 g / per 100 ml as declared) using the Open Food Facts open database. They are not medical or dietary advice, and do not reflect compliance status.',
  }
}

export const _internal = { round1, fmt, NUTRIENT_LABELS }