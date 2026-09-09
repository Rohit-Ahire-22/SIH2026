import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractProductFields } from '../src/services/ocrFieldExtractionService.js'

test('Test 5: Y-clustering line reconstruction', () => {
  const fields = extractProductFields([
    // Label and value side-by-side but returned as separate OCR blocks with Y-overlap
    { text: 'Net Qty:', box: [[10, 10], [50, 10], [50, 20], [10, 20]], confidence: 0.99 },
    { text: '500', box: [[55, 9], [75, 9], [75, 21], [55, 21]], confidence: 0.99 },
    { text: 'g', box: [[80, 11], [90, 11], [90, 19], [80, 19]], confidence: 0.99 },
    // Another line
    { text: 'MRP', box: [[10, 60], [50, 60], [50, 70], [10, 70]], confidence: 0.99 },
    { text: 'Rs', box: [[60, 59], [80, 59], [80, 71], [60, 71]], confidence: 0.99 },
    { text: '250', box: [[81, 60], [106, 60], [106, 70], [81, 70]], confidence: 0.99 }
  ])

  assert.equal(fields.netQuantity.value, 500)
  assert.equal(fields.netQuantity.unit, 'g')
  assert.equal(typeof fields.netQuantity.evidence, 'string')
  assert.equal(typeof fields.netQuantity.confidence, 'number')
  assert.equal(fields.mrp.value, 250)
  assert.equal(typeof fields.mrp.evidence, 'string')
  assert.equal(typeof fields.mrp.confidence, 'number')
})

test('Test 6: Vertical Lookahead', () => {
  const fields = extractProductFields([
    { text: 'MRP', box: [[10, 10], [50, 10], [50, 20], [10, 20]], confidence: 0.99 },
    // Blank or irrelevant space
    { text: 'Rs 199.00', box: [[10, 30], [80, 30], [80, 40], [10, 40]], confidence: 0.99 },
    
    { text: 'Country of Origin:', box: [[10, 50], [100, 50], [100, 60], [10, 60]], confidence: 0.99 },
    { text: 'India', box: [[10, 70], [50, 70], [50, 80], [10, 80]], confidence: 0.99 }
  ])

  assert.equal(fields.mrp.value, 199)
  assert.equal(typeof fields.mrp.evidence, 'string')
  assert.equal(typeof fields.mrp.confidence, 'number')
  assert.equal(fields.countryOfOrigin.value, 'India')
  assert.equal(typeof fields.countryOfOrigin.evidence, 'string')
  assert.equal(typeof fields.countryOfOrigin.confidence, 'number')
})
