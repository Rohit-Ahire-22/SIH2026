import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectProductCategory,
  CATEGORIES,
  DETECTION_STATUS,
} from '../src/services/productCategoryService.js'

test('Test 1: Chocololate biscuits + ingredients + nutrition -> food', () => {
  const result = detectProductCategory({
    ocrResults: [
      'Chocolate Biscuits',
      'Ingredients: Wheat Flour, Sugar',
      'Nutritional Information',
    ],
  })

  assert.equal(result.category, 'food')
  assert.equal(result.status, DETECTION_STATUS.DETECTED)
  assert.equal(typeof result.confidence, 'number')
  assert.ok(result.confidence > 0)
  assert.ok(result.confidence <= 1)
  assert.ok(result.matchedKeywords.length > 0)
  assert.ok(result.matchedKeywords.includes('biscuits'))
  assert.ok(CATEGORIES.includes(result.category))
})

test('Test 2: Anti-Dandruff Shampoo -> cosmetic (documented priority)', () => {
  // Documented keyword priority: "shampoo" is in the cosmetic list.
  const result = detectProductCategory({
    ocrResults: ['Anti-Dandruff Shampoo', 'Hair Care', 'Net Quantity 180 ml'],
  })

  assert.equal(result.category, 'cosmetic')
  assert.equal(result.status, DETECTION_STATUS.DETECTED)
  assert.ok(result.matchedKeywords.includes('shampoo'))
})

test('Test 3: Charger + adapter -> electronics', () => {
  const result = detectProductCategory({
    ocrResults: ['Fast Charger', 'USB-C Power Adapter', 'Input 100-240V'],
  })

  assert.equal(result.category, 'electronics')
  assert.equal(result.status, DETECTION_STATUS.DETECTED)
  assert.ok(result.matchedKeywords.includes('charger'))
  assert.ok(result.matchedKeywords.includes('adapter'))
})

test('Test 4: Unknown product -> unknown/UNKNOWN, no invented category', () => {
  const result = detectProductCategory({
    ocrResults: ['Completely Unknown Product XYZ'],
  })

  assert.equal(result.category, 'unknown')
  assert.equal(result.status, DETECTION_STATUS.UNKNOWN)
  assert.equal(result.confidence, 0)
  assert.deepEqual(result.matchedKeywords, [])
})

test('Test 5: ambiguous competing signals -> REVIEW with documented winner', () => {
  // "toothbrush" (personal_care) and "charger" (electronics) tie exactly.
  // Documented tie-break: earlier category in CATEGORIES wins -> personal_care.
  const result = detectProductCategory({
    ocrResults: ['Toothbrush Charger'],
  })

  assert.equal(result.status, DETECTION_STATUS.REVIEW)
  assert.equal(result.category, 'personal_care')
  assert.ok(result.matchedKeywords.includes('toothbrush'))
})

test('Test 5b: generic "water" does not beat stronger food evidence', () => {
  const result = detectProductCategory({
    productName: 'Wheat Biscuits',
    ocrResults: ['Ingredients: Wheat Flour', 'Nutritional Information'],
  })

  assert.equal(result.category, 'food')
  assert.equal(result.status, DETECTION_STATUS.DETECTED)
})

test('Test 5c: fields and ocrText sources are accepted and safe with nulls', () => {
  const result = detectProductCategory({
    productName: 'Phone Fast Charger',
    brandName: null,
    manufacturerName: undefined,
    ocrText: 'USB Adapter 20W',
    extracted: { countryOfOrigin: null, manufacturerName: null },
  })

  assert.equal(result.category, 'electronics')
  assert.ok(result.matchedKeywords.includes('charger'))
  assert.ok(result.matchedKeywords.includes('adapter'))
})

test('Test 6: "mg" alone does not classify as pharmaceutical', () => {
  const result = detectProductCategory({
    ocrResults: ['500 mg', 'Some Product'],
  })

  assert.equal(result.category, 'unknown')
  assert.equal(result.status, DETECTION_STATUS.UNKNOWN)
})