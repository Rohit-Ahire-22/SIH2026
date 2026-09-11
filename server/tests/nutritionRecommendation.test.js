/**
 * Nutrition Recommendation Service — Unit Tests
 * node --test tests/nutritionRecommendation.test.js
 *
 * All scoring / normalisation logic is tested WITHOUT network access.
 * The external Open Food Facts search is injected via options.searchFn
 * in orchestration tests.
 */
import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  detectCategory,
  normalizeScannedNutrients,
  normalizeNutriments,
  scoreCandidates,
  buildRecommendations,
  normalizeOfficialCandidates,
  CATEGORY_PROFILES,
  _clearSearchCache,
} from '../src/services/nutritionRecommendationService.js'

// ─── detectCategory ──────────────────────────────────────────────────────────

describe('detectCategory — keyword-based classification', () => {
  test('detects biscuits from "cream biscuit" label', () => {
    const r = detectCategory('Bourbon cream biscuit 250g')
    assert.equal(r.key, 'biscuits')
    assert.ok(r.confidence > 0)
  })

  test('detects snacks from label text', () => {
    const r = detectCategory('Potato chips namkeen wafers')
    assert.equal(r.key, 'snacks')
  })

  test('detects beverages from label text', () => {
    const r = detectCategory('Orange juice cold drink')
    assert.equal(r.key, 'beverages')
  })

  test('detects breakfast_cereals from "corn flakes"', () => {
    const r = detectCategory('Corn flakes breakfast cereal 500g')
    assert.equal(r.key, 'breakfast_cereals')
  })

  test('returns unspecified when no keywords found', () => {
    const r = detectCategory('some random text 12345')
    assert.equal(r.key, 'unspecified')
    assert.equal(r.confidence, 0)
  })

  test('returns unspecified for empty input', () => {
    const r = detectCategory('')
    assert.equal(r.key, 'unspecified')
  })

  test('detects chocolate_confectionery from chocolate label', () => {
    const r = detectCategory('Chocolate bar 50g')
    assert.equal(r.key, 'chocolate_confectionery')
  })
})

// ─── normalizeScannedNutrients ──────────────────────────────────────────────

describe('normalizeScannedNutrients — canonical shape', () => {
  test('converts Energy in kcal', () => {
    const scan = [{ name: 'Energy', value: 451, unit: 'kcal' }]
    const out = normalizeScannedNutrients(scan)
    assert.equal(out.energy, 451)
  })

  test('converts Energy in kJ to kcal', () => {
    const scan = [{ name: 'Energy', value: 1200, unit: 'kJ' }]
    const out = normalizeScannedNutrients(scan)
    assert.ok(Math.abs(out.energy - 1200 / 4.184) < 1)
  })

  test('returns null for empty array', () => {
    assert.equal(normalizeScannedNutrients([]), null)
  })

  test('returns null when all values are null', () => {
    assert.equal(normalizeScannedNutrients([{ name: 'Energy', value: null }]), null)
  })

  test('handles typical Indian nutrition label', () => {
    const nutrients = [
      { name: 'Energy', value: 451, unit: 'kcal' },
      { name: 'Protein', value: 6.5, unit: 'g' },
      { name: 'Total Fat', value: 12.5, unit: 'g' },
      { name: 'Saturated Fat', value: 6.5, unit: 'g' },
      { name: 'Trans Fat', value: 0, unit: 'g' },
      { name: 'Carbohydrates', value: 78.2, unit: 'g' },
      { name: 'Total Sugars', value: 25.5, unit: 'g' },
      { name: 'Sodium', value: 380, unit: 'mg' },
    ]
    const out = normalizeScannedNutrients(nutrients)
    assert.equal(out.energy, 451)
    assert.equal(out.protein, 6.5)
    assert.equal(out.totalFat, 12.5)
    assert.equal(out.saturatedFat, 6.5)
    assert.equal(out.sugars, 25.5)
    assert.equal(out.sodium, 380)
  })
})

// ─── normalizeNutriments (OFF) ─────────────────────────────────────────────

describe('normalizeNutriments — OFF nutriments to canonical', () => {
  test('converts energy-kcal_100g and proteins_100g', () => {
    const out = normalizeNutriments({
      'energy-kcal_100g': 420,
      'proteins_100g': 8,
      'fat_100g': 15,
      'saturated-fat_100g': 7,
      'sugars_100g': 30,
      'fiber_100g': 3,
      'sodium_100g': 350,
    })
    assert.equal(out.energy, 420)
    assert.equal(out.protein, 8)
    assert.equal(out.totalFat, 15)
    assert.equal(out.saturatedFat, 7)
    assert.equal(out.sugars, 30)
    assert.equal(out.fibre, 3)
    assert.equal(out.sodium, 350)
  })

  test('converts energy_100g (kJ) when energy-kcal missing', () => {
    const out = normalizeNutriments({ energy_100g: 840, 'proteins_100g': 5 })
    assert.ok(Math.abs(out.energy - 840 / 4.184) < 1)
  })

  test('derives sodium from salt_100g when sodium_100g missing', () => {
    const out = normalizeNutriments({ salt_100g: 1 })
    assert.equal(out.sodium, 400)
  })

  test('returns empty object for null input', () => {
    assert.deepEqual(normalizeNutriments(null), {})
  })
})

// ─── scoreCandidates — category-aware ranking ──────────────────────────────

describe('scoreCandidates — scoring and ranking', () => {
  const scannedBiscuit = {
    energy: 480,
    protein: 6,
    totalFat: 18,
    saturatedFat: 8,
    sugars: 30,
  }

  const betterCandidate = {
    id: '100',
    name: 'Low Sugar Biscuit',
    brand: 'TestBrand',
    quantity: '200 g',
    imageUrl: null,
    productUrl: null,
    values: { energy: 420, protein: 7, totalFat: 12, saturatedFat: 4, sugars: 10 },
    per100: 'g',
    nutrientLevels: null,
    novaGroup: null,
  }

  const worseCandidate = {
    id: '101',
    name: 'Sweet Biscuit',
    brand: 'TestBrand',
    quantity: '200 g',
    imageUrl: null,
    productUrl: null,
    values: { energy: 520, protein: 5, totalFat: 22, saturatedFat: 11, sugars: 40 },
    per100: 'g',
    nutrientLevels: null,
    novaGroup: null,
  }

  const partialCandidate = {
    id: '102',
    name: 'Mystery Biscuit',
    brand: null,
    quantity: null,
    imageUrl: null,
    productUrl: null,
    // Declared nutrients are NOT part of the biscuits profile (no overlap) →
    // nothing comparable, candidate must be excluded entirely.
    values: { transFat: 2, carbohydrates: 50 },
    per100: 'g',
  }

  test('better candidate scores higher than worse', () => {
    const r = scoreCandidates(scannedBiscuit, 'biscuits', [worseCandidate, betterCandidate])
    assert.equal(r.status, 'recommendations')
    assert.equal(r.recommendations.length, 1)
    assert.equal(r.recommendations[0].name, 'Low Sugar Biscuit')
    assert.ok(r.recommendations[0].score > 0)
    assert.equal(r.recommendations[0].source, 'Open Food Facts')
    assert.ok(typeof r.recommendations[0].dataCompleteness === 'number')
    assert.ok(r.recommendations[0].dataCompleteness > 0 && r.recommendations[0].dataCompleteness <= 1)
    assert.ok(r.recommendations[0].advantages.length >= 1, 'should include why-we-recommended-it narrative')
    assert.ok(r.recommendations[0].reasons.length >= 1, 'should include percentage reasons')
  })

  test('worse-only candidates trigger scanned_competitive', () => {
    const r = scoreCandidates(scannedBiscuit, 'biscuits', [worseCandidate])
    assert.equal(r.status, 'scanned_competitive')
    assert.equal(r.scannedIsCompetitive, true)
    assert.equal(r.recommendations.length, 0)
  })

  test('candidates with no covered profile nutrients are excluded', () => {
    const r = scoreCandidates(scannedBiscuit, 'biscuits', [partialCandidate])
    assert.equal(r.status, 'no_comparable_products')
    assert.equal(r.noComparableData, true)
  })

  test('reasons do not contain medical claims', () => {
    const r = scoreCandidates(scannedBiscuit, 'biscuits', [betterCandidate])
    for (const rec of r.recommendations) {
      for (const reason of rec.reasons) {
        assert.ok(!reason.toLowerCase().includes('health'), 'reason must not say health')
        assert.ok(!reason.toLowerCase().includes('diet'), 'reason must not say diet')
        assert.ok(!reason.toLowerCase().includes('cure'), 'reason must not say cure')
      }
    }
  })

  test('rankings are sorted by score descending', () => {
    const veryGood = { ...betterCandidate, id: '200', name: 'Very Low Sugar', values: { energy: 380, protein: 8, totalFat: 10, saturatedFat: 3, sugars: 5 } }
    const ok = { ...betterCandidate, id: '201', name: 'Moderate', values: { energy: 430, protein: 6, totalFat: 14, saturatedFat: 5, sugars: 20 } }
    const r = scoreCandidates(scannedBiscuit, 'biscuits', [ok, veryGood])
    assert.equal(r.recommendations.length, 2)
    assert.ok(r.recommendations[0].score >= r.recommendations[1].score)
  })

  test('empty candidates list yields no_comparable_products', () => {
    const r = scoreCandidates(scannedBiscuit, 'biscuits', [])
    assert.equal(r.status, 'no_comparable_products')
    assert.equal(r.noComparableData, true)
  })

  test('higher-protein dairy candidate scores correctly with higher-is-better', () => {
    const scannedMilk = { saturatedFat: 8, sugars: 10, protein: 2, sodium: 40 }
    const highProtein = {
      id: '300',
      name: 'High Protein Milk',
      values: { saturatedFat: 5, sugars: 8, protein: 4, sodium: 35 },
    }
    const lowProtein = {
      id: '301',
      name: 'Low Protein Milk',
      values: { saturatedFat: 5, sugars: 8, protein: 1, sodium: 35 },
    }
    const r = scoreCandidates(scannedMilk, 'milk_dairy', [lowProtein, highProtein])
    assert.equal(r.status, 'recommendations')
    assert.equal(r.recommendations[0].name, 'High Protein Milk')
  })
})

// ─── buildRecommendations orchestration (network-free via searchFn stub) ───

describe('buildRecommendations — orchestration', () => {
  // searchFn contract: NORMALISED candidates (same shape that the default
  // searchSimilarProducts returns after normalizeOfficialCandidates).
  const FIXTURE_CANDIDATES = [
    {
      id: '100',
      name: 'Test Healthy Cereal',
      brand: 'TestBrand',
      quantity: '300 g',
      imageUrl: null,
      productUrl: null,
      values: { energy: 320, protein: 10, totalFat: 3, saturatedFat: 1, sugars: 8, fibre: 8, sodium: 100 },
      per100: 'g',
      nutrientLevels: { fat: 'low', sugars: 'low' },
      novaGroup: 1,
    },
    {
      id: '101',
      name: 'Sugary Cereal',
      brand: 'TestBrand',
      quantity: '250 g',
      imageUrl: null,
      productUrl: null,
      values: { energy: 500, protein: 4, totalFat: 10, saturatedFat: 5, sugars: 35, fibre: 1, sodium: 500 },
      per100: 'g',
      nutrientLevels: null,
      novaGroup: null,
    },
  ]

  const mockSearch = async () => FIXTURE_CANDIDATES

  const scannedCereal = [
    { name: 'Energy', value: 400, unit: 'kcal' },
    { name: 'Protein', value: 6, unit: 'g' },
    { name: 'Total Fat', value: 8, unit: 'g' },
    { name: 'Saturated Fat', value: 4, unit: 'g' },
    { name: 'Total Sugars', value: 20, unit: 'g' },
    { name: 'Dietary Fibre', value: 3, unit: 'g' },
    { name: 'Sodium', value: 300, unit: 'mg' },
  ]

  test('detects breakfast_cereals and returns better candidate', async () => {
    const r = await buildRecommendations(scannedCereal, 'Corn Flakes 200g', '', { searchFn: mockSearch })
    assert.equal(r.category.key, 'breakfast_cereals')
    assert.equal(r.status, 'recommendations')
    assert.ok(r.recommendations.length >= 1)
    assert.equal(r.recommendations[0].name, 'Test Healthy Cereal')
  })

  test('no medical claims in disclaimer or reasons', async () => {
    const r = await buildRecommendations(scannedCereal, 'Corn Flakes 200g', '', { searchFn: mockSearch })
    assert.ok(!r.disclaimer.toLowerCase().includes('healthier'))
    assert.ok(!r.disclaimer.toLowerCase().includes('cure'))
    for (const rec of r.recommendations) {
      for (const reason of rec.reasons) {
        assert.ok(!reason.toLowerCase().includes('health'))
      }
    }
  })

  test('returns no_comparable_products when search returns empty', async () => {
    const r = await buildRecommendations(scannedCereal, 'Corn Flakes 200g', '', { searchFn: async () => [] })
    assert.equal(r.status, 'no_comparable_products')
    assert.equal(r.noComparableData, true)
  })

  test('returns no_comparable_products when nutrients are all null', async () => {
    const nullNutrients = [{ name: 'Energy', value: null, unit: null }]
    const r = await buildRecommendations(nullNutrients, 'Unknown Product', '', { searchFn: mockSearch })
    assert.equal(r.status, 'no_comparable_products')
  })

  test('no hardcoded brand names appear in recommendations', async () => {
    const r = await buildRecommendations(scannedCereal, 'Corn Flakes 200g', '', { searchFn: mockSearch })
    const all = JSON.stringify(r).toLowerCase()
    assert.ok(!all.includes('parle'))
    assert.ok(!all.includes('britannia'))
    assert.ok(!all.includes('nestle'))
  })

  test('searchFn is called with the correct category key', async () => {
    let calledWith = null
    const spy = async (key, text) => { calledWith = key; return FIXTURE_CANDIDATES }
    await buildRecommendations(scannedCereal, 'Corn Flakes', '', { searchFn: spy })
    assert.equal(calledWith, 'breakfast_cereals')
  })

  test('flags low category confidence when category cannot be detected', async () => {
    const r = await buildRecommendations(scannedCereal, 'XYZ abc 123', '', { searchFn: mockSearch })
    assert.equal(r.category.key, 'unspecified')
    assert.equal(r.lowCategoryConfidence, true)
  })

  test('confident category is not flagged as low confidence', async () => {
    const r = await buildRecommendations(scannedCereal, 'Corn Flakes', '', { searchFn: mockSearch })
    assert.equal(r.category.key, 'breakfast_cereals')
    assert.equal(r.lowCategoryConfidence, false)
  })
})

// ─── normalizeOfficialCandidates ────────────────────────────────────────────

describe('normalizeOfficialCandidates — OFF product mapping', () => {
  test('skips products without product_name', () => {
    const out = normalizeOfficialCandidates([{ code: '1' }])
    assert.equal(out.length, 0)
  })

  test('skips products without usable nutrients', () => {
    const out = normalizeOfficialCandidates([{ code: '1', product_name: 'No Nutrients', nutriments: {} }])
    assert.equal(out.length, 0)
  })

  test('detects per-100ml basis for beverages', () => {
    const out = normalizeOfficialCandidates([{
      code: '2',
      product_name: 'Soda',
      nutriments: { 'energy_100mL': 180, sugars_100mL: 10 },
    }])
    assert.equal(out[0].per100, 'ml')
  })

  test('products without code still produce a candidate (null id)', () => {
    const out = normalizeOfficialCandidates([{
      product_name: 'Generic',
      nutriments: { 'energy-kcal_100g': 100, sugars_100g: 5 },
    }])
    assert.equal(out.length, 1)
    assert.equal(out[0].id, null)
  })
})

// ─── Existing profile check ─────────────────────────────────────────────────

describe('CATEGORY_PROFILES — sanity', () => {
  test('every profile has weights that sum approximately to 1', () => {
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      const weightSum = Object.values(profile.priorities)
        .reduce((s, p) => s + p.weight, 0)
      assert.ok(weightSum >= 0.95 && weightSum <= 1.05, `Profile ${key} weights should sum ~1, got ${weightSum}`)
    }
  })

  test('all profiles use only valid direction values', () => {
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      for (const [nk, p] of Object.entries(profile.priorities)) {
        assert.ok(p.direction === 'lower' || p.direction === 'higher', `${key}.${nk} direction must be lower or higher`)
      }
    }
  })
})

// ─── Fetch retry — transient OFF failure recovery ───────────────────────────

describe('fetch retry — transient Open Food Facts failures', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    _clearSearchCache()
  })

  function okJson(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  function errResponse(status) {
    return new Response(`<!DOCTYPE html><title>temporarily unavailable</title>`, {
      status,
      headers: { 'content-type': 'text/html' },
    })
  }

  const VALID_OFF_PRODUCTS = {
    count: 100,
    products: [
      {
        code: '111',
        product_name: 'Healthy Snack',
        brands: 'TestBrand',
        quantity: '100g',
        image_front_url: null,
        nutriments: {
          'energy-kcal_100g': 300,
          'proteins_100g': 10,
          'fat_100g': 5,
          'saturated-fat_100g': 2,
          'sugars_100g': 3,
          'sodium_100g': 200,
        },
        nutrient_levels: {},
        nova_group: 1,
      },
      {
        code: '222',
        product_name: 'Another Good Snack',
        brands: 'TestBrand2',
        quantity: '200g',
        image_front_url: null,
        nutriments: {
          'energy-kcal_100g': 280,
          'proteins_100g': 12,
          'fat_100g': 4,
          'saturated-fat_100g': 1,
          'sugars_100g': 2,
          'sodium_100g': 180,
        },
        nutrient_levels: {},
        nova_group: 1,
      },
    ],
  }

  const SCANNED_SNACK = [
    { name: 'Energy', value: 350, unit: 'kcal' },
    { name: 'Protein', value: 5, unit: 'g' },
    { name: 'Total Fat', value: 10, unit: 'g' },
    { name: 'Saturated Fat', value: 3, unit: 'g' },
    { name: 'Total Sugars', value: 8, unit: 'g' },
    { name: 'Sodium', value: 300, unit: 'mg' },
  ]

  function isStructuredSearchUrl(url) {
    return typeof url === 'string' && url.includes('/api/v2/search') && url.includes('categories_tags')
  }

  test('A. 503 then 200: retry recovers and produces recommendations', async () => {
    let callCount = 0
    globalThis.fetch = async (url) => {
      callCount++
      if (isStructuredSearchUrl(url)) {
        return callCount === 1 ? errResponse(503) : okJson(VALID_OFF_PRODUCTS)
      }
      return errResponse(503)
    }

    const r = await buildRecommendations(SCANNED_SNACK, 'Potato chips 100g', '', {})
    assert.equal(r.status, 'recommendations')
    assert.ok(r.recommendations.length >= 1, 'should have at least 1 recommendation')
    assert.ok(r.recommendations.length <= 5, 'should have at most 5 recommendations')
    assert.ok(callCount >= 2, 'should have retried at least once')
  })

  test('B. 503 then 503 then 200: bounded retry succeeds on third attempt', async () => {
    let callCount = 0
    globalThis.fetch = async (url) => {
      callCount++
      if (isStructuredSearchUrl(url)) {
        if (callCount <= 2) return errResponse(503)
        return okJson(VALID_OFF_PRODUCTS)
      }
      return errResponse(503)
    }

    const r = await buildRecommendations(SCANNED_SNACK, 'Potato chips 100g', '', {})
    assert.equal(r.status, 'recommendations')
    assert.ok(r.recommendations.length >= 1)
    assert.equal(callCount, 3, 'should have made exactly 3 fetch attempts')
  })

  test('C. 503 x3: bounded retry stops, returns graceful no_comparable_products', async () => {
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      return errResponse(503)
    }

    const r = await buildRecommendations(SCANNED_SNACK, 'Chips 100g', '', {})
    assert.equal(r.status, 'no_comparable_products')
    assert.equal(r.noComparableData, true)
    assert.equal(callCount, 3, 'should retry exactly 3 times then stop')
    assert.equal(r.recommendations.length, 0)
  })

  test('D. 429 is retryable and recovers', async () => {
    let callCount = 0
    globalThis.fetch = async (url) => {
      callCount++
      if (isStructuredSearchUrl(url) && callCount === 1) return errResponse(429)
      if (isStructuredSearchUrl(url)) return okJson(VALID_OFF_PRODUCTS)
      return errResponse(503)
    }

    const r = await buildRecommendations(SCANNED_SNACK, 'Chips 100g', '', {})
    assert.equal(r.status, 'recommendations')
    assert.ok(r.recommendations.length >= 1)
    assert.ok(callCount >= 2, 'should have retried after 429')
  })

  test('E. 400 does NOT retry — immediate graceful failure', async () => {
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      return errResponse(400)
    }

    const r = await buildRecommendations(SCANNED_SNACK, 'Chips 100g', '', {})
    assert.equal(r.status, 'no_comparable_products')
    assert.equal(callCount, 1, 'should NOT have retried on 400')
  })

  test('F. 404 does NOT retry', async () => {
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      return errResponse(404)
    }

    const r = await buildRecommendations(SCANNED_SNACK, 'Chips 100g', '', {})
    assert.equal(r.status, 'no_comparable_products')
    assert.equal(callCount, 1, 'should NOT have retried on 404')
  })

  test('no fabricated products when all retries fail', async () => {
    globalThis.fetch = async () => errResponse(503)

    const r = await buildRecommendations(SCANNED_SNACK, 'Chips 100g', '', {})
    assert.equal(r.recommendations.length, 0)
    assert.equal(r.status, 'no_comparable_products')
    const all = JSON.stringify(r)
    assert.ok(!all.includes('Healthy'), 'must not contain any product names')
    assert.ok(!all.includes('TestBrand'), 'must not contain any brand names')
  })

  test('recommendations from successful retry contain real OFF data', async () => {
    let callCount = 0
    globalThis.fetch = async (url) => {
      callCount++
      if (isStructuredSearchUrl(url)) return okJson(VALID_OFF_PRODUCTS)
      return errResponse(503)
    }

    const r = await buildRecommendations(SCANNED_SNACK, 'Chips 100g', '', {})
    assert.equal(r.status, 'recommendations')
    const top = r.recommendations[0]
    assert.ok(['Healthy Snack', 'Another Good Snack'].includes(top.name), 'should be one of the OFF products')
    assert.ok(top.source === 'Open Food Facts')
    assert.ok(top.score > 0)
    assert.ok(top.reasons.length >= 1, 'should have at least one reason')
    assert.ok(top.advantages.length >= 1, 'should have at least one advantage')
    assert.ok(top.limitations.length >= 0, 'limitations array should exist')
  })
})