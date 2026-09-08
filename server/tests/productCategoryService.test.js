import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectProductCategory,
  CATEGORIES,
  DETECTION_STATUS,
} from '../src/services/productCategoryService.js'

test('Test 1: detergent as semantic evidence', () => {
  const result = detectProductCategory({ productName: 'Active Detergent' })
  assert.equal(result.category, 'household')
  const signal = result.matchedSignals.find(s => s.signal === 'detergent')
  assert.ok(signal)
  assert.equal(signal.layer, 'SEMANTIC_PRODUCT_NAME')
  assert.equal(signal.weight, 5)
})

test('Test 2: FSSAI as explicit regulatory evidence', () => {
  const result = detectProductCategory({ ocrResults: ['fssai lic no 12345'] })
  // food and beverage both get 10 points for fssai
  assert.equal(result.status, DETECTION_STATUS.REVIEW)
  const signal = result.matchedSignals.find(s => s.signal === 'fssai')
  assert.ok(signal)
  assert.equal(signal.layer, 'EXPLICIT_REGULATORY')
  assert.equal(signal.weight, 10)
})

test('Test 3: shampoo as semantic evidence', () => {
  const result = detectProductCategory({ productName: 'Herbal Shampoo' })
  assert.equal(result.category, 'cosmetic')
  assert.equal(result.status, DETECTION_STATUS.REVIEW) // Score 5, < 8 so REVIEW
  const signal = result.matchedSignals.find(s => s.signal === 'shampoo')
  assert.ok(signal)
  assert.equal(signal.layer, 'SEMANTIC_PRODUCT_NAME')
})

test('Test 4: avoid-contact-with-eyes as packaging evidence', () => {
  const result = detectProductCategory({ ocrResults: ['Avoid contact with eyes'] })
  assert.ok(['cosmetic', 'personal_care'].includes(result.category))
  const signal = result.matchedSignals.find(s => s.signal === 'avoid contact with eyes')
  assert.ok(signal)
  assert.equal(signal.layer, 'PACKAGING_DECLARATION')
  assert.equal(signal.weight, 6)
})

test('Test 5: nutritional-information as packaging evidence', () => {
  const result = detectProductCategory({ ocrResults: ['Nutritional Information'] })
  assert.ok(['food', 'beverage'].includes(result.category))
  const signal = result.matchedSignals.find(s => s.signal === 'nutritional information')
  assert.ok(signal)
  assert.equal(signal.layer, 'PACKAGING_DECLARATION')
})

test('Test 6: generic promotional words not becoming strong evidence', () => {
  const result = detectProductCategory({ ocrResults: ['Clean your house today! Amazing wash!'] })
  assert.equal(result.category, 'household')
  assert.equal(result.status, DETECTION_STATUS.REVIEW) 
})

test('Test 7: one weak keyword -> UNKNOWN', () => {
  const result = detectProductCategory({ ocrResults: ['taste'] })
  assert.equal(result.category, 'unknown')
  assert.equal(result.status, DETECTION_STATUS.UNKNOWN)
})

test('Test 8: two independent medium signals -> appropriate confidence', () => {
  // Shampoo (Semantic: 5) + Avoid contact with eyes (Packaging: 6) = 11. > 8, DETECTED
  const result = detectProductCategory({ 
      productName: 'Shampoo',
      ocrResults: ['Avoid contact with eyes'] 
  })
  assert.equal(result.category, 'cosmetic')
  assert.equal(result.status, DETECTION_STATUS.DETECTED)
  assert.ok(result.confidence >= 0.8)
})

test('Test 9: strong + weak conflicting evidence -> REVIEW or DETECTED depending on gap', () => {
  const result = detectProductCategory({ 
      ocrResults: ['FSSAI', 'Taste this delicious snack'] 
  })
  assert.equal(result.category, 'food')
  assert.equal(result.status, DETECTION_STATUS.DETECTED)
})

test('Test 10: close category scores -> REVIEW', () => {
  // Cosmetic: avoid contact with eyes (+6).
  // Pharmaceutical: keep out of reach of children (+6).
  const result = detectProductCategory({ 
      ocrResults: ['Avoid contact with eyes', 'Keep out of reach of children'] 
  })
  assert.equal(result.status, DETECTION_STATUS.REVIEW)
})

test('Test 11: completely unknown OCR -> UNKNOWN', () => {
  const result = detectProductCategory({ ocrResults: ['abcdefg'] })
  assert.equal(result.status, DETECTION_STATUS.UNKNOWN)
  assert.equal(result.category, 'unknown')
})

test('Test 12: status terminology remains distinct from compliance PASS/FAIL', () => {
  // We use DETECTED, REVIEW, UNKNOWN. Never PASS/FAIL.
  const result = detectProductCategory({ ocrResults: ['fssai', 'ingredients'] })
  assert.ok(['DETECTED', 'REVIEW', 'UNKNOWN'].includes(result.status))
  assert.ok(!['PASS', 'FAIL'].includes(result.status))
})