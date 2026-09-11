/**
 * Nutrition Scanner — Unit Tests
 * node --test tests/nutrition.test.js
 */
import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'

// Test the extraction logic directly — isolated from OCR service
import { compareNutrients } from '../src/services/nutritionExtractionService.js'

describe('Nutrition Extraction — compareNutrients', () => {
  test('compare returns neutral notes, not medical claims', () => {
    const a = [
      { name: 'Energy', value: 300, unit: 'kcal', confidence: 0.9 },
      { name: 'Protein', value: 10, unit: 'g', confidence: 0.85 },
      { name: 'Sodium', value: 500, unit: 'mg', confidence: 0.8 },
    ]
    const b = [
      { name: 'Energy', value: 200, unit: 'kcal', confidence: 0.9 },
      { name: 'Protein', value: 10, unit: 'g', confidence: 0.85 },
      { name: 'Sodium', value: 800, unit: 'mg', confidence: 0.8 },
    ]
    const result = compareNutrients(a, b)

    // Energy: A=300, B=200 → Lower in Product B
    const energy = result.find(r => r.nutrient === 'Energy')
    assert.ok(energy, 'Energy row should be present')
    assert.equal(energy.note, 'Lower in Product B')

    // Protein: equal
    const protein = result.find(r => r.nutrient === 'Protein')
    assert.equal(protein.note, 'Equal')

    // Sodium: A=500, B=800 → Lower in Product A
    const sodium = result.find(r => r.nutrient === 'Sodium')
    assert.equal(sodium.note, 'Lower in Product A')

    // Verify no medical/health claims in notes
    result.forEach(row => {
      assert.ok(!row.note.includes('healthier'), 'Should not claim healthier')
      assert.ok(!row.note.includes('better'), 'Should not claim better')
      assert.ok(!row.note.includes('recommended'), 'Should not claim recommended')
    })
  })

  test('handles null values as insufficient data', () => {
    const a = [{ name: 'Energy', value: null, unit: null, confidence: 0 }]
    const b = [{ name: 'Energy', value: 200, unit: 'kcal', confidence: 0.9 }]
    const result = compareNutrients(a, b)
    const energy = result.find(r => r.nutrient === 'Energy')
    assert.ok(energy.note.includes('Insufficient'))
  })

  test('handles both null — both insufficient', () => {
    const a = [{ name: 'Protein', value: null, unit: null, confidence: 0 }]
    const b = [{ name: 'Protein', value: null, unit: null, confidence: 0 }]
    const result = compareNutrients(a, b)
    const protein = result.find(r => r.nutrient === 'Protein')
    assert.ok(protein.note.includes('Insufficient'))
  })

  test('preserves values correctly in comparison rows', () => {
    const a = [{ name: 'Sodium', value: 250, unit: 'mg', confidence: 0.7 }]
    const b = [{ name: 'Sodium', value: 300, unit: 'mg', confidence: 0.8 }]
    const result = compareNutrients(a, b)
    const row = result.find(r => r.nutrient === 'Sodium')
    assert.equal(row.productA.value, 250)
    assert.equal(row.productB.value, 300)
    assert.equal(row.productA.unit, 'mg')
    assert.equal(row.productB.unit, 'mg')
  })

  test('handles different nutrients in each product gracefully', () => {
    const a = [{ name: 'Energy', value: 100, unit: 'kcal', confidence: 0.9 }]
    const b = [{ name: 'Protein', value: 5, unit: 'g', confidence: 0.9 }]
    const result = compareNutrients(a, b)
    assert.ok(result.length === 2, 'Should include all nutrients from both')

    const energy = result.find(r => r.nutrient === 'Energy')
    assert.equal(energy.productA.value, 100)
    assert.equal(energy.productB.value, null)
    assert.ok(energy.note.includes('Insufficient'))

    const protein = result.find(r => r.nutrient === 'Protein')
    assert.equal(protein.productA.value, null)
    assert.equal(protein.productB.value, 5)
    assert.ok(protein.note.includes('Insufficient'))
  })
})

describe('Nutrition Controller — compare endpoint IDOR checks', () => {
  // Test controller IDOR protection
  test('compareScans requires both a and b parameters', async () => {
    const { compareScans } = await import('../src/controllers/nutritionController.js')
    const req = { query: {}, user: { userId: 'user1' } }
    const res = {
      statusValue: null, jsonValue: null,
      status(v) { this.statusValue = v; return this },
      json(v) { this.jsonValue = v; return this },
    }
    await compareScans(req, res, () => {})
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('"a"') || res.jsonValue.message.includes('required'))
  })

  test('compareScans rejects same scan ID for both', async () => {
    const { compareScans } = await import('../src/controllers/nutritionController.js')
    const mongoose = await import('mongoose')
    const id = new mongoose.default.Types.ObjectId().toString()
    const req = { query: { a: id, b: id }, user: { userId: 'user1' } }
    const res = {
      statusValue: null, jsonValue: null,
      status(v) { this.statusValue = v; return this },
      json(v) { this.jsonValue = v; return this },
    }
    await compareScans(req, res, () => {})
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('different'))
  })
})

describe('Nutrition — units are preserved, not invented', () => {
  test('compare row preserves exact unit strings', () => {
    const a = [{ name: 'Energy', value: 100, unit: 'kJ', confidence: 0.8 }]
    const b = [{ name: 'Energy', value: 200, unit: 'kcal', confidence: 0.9 }]
    const result = compareNutrients(a, b)
    const row = result.find(r => r.nutrient === 'Energy')
    assert.equal(row.productA.unit, 'kJ')
    assert.equal(row.productB.unit, 'kcal')
  })
})
