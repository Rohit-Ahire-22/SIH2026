import { test, describe } from 'node:test'
import assert from 'node:assert'
import { normalizeNetQuantity, validateQuantity, QUANTITY_KINDS, BASE_UNITS } from '../../src/legal/compliance/netQuantityService.js'

describe('netQuantityService', () => {
  describe('Normalization', () => {
    test('normalizes mass', () => {
      const res = normalizeNetQuantity('500 g')
      assert.strictEqual(res.quantityKind, QUANTITY_KINDS.MASS)
      assert.strictEqual(res.unit, 'g')
      assert.strictEqual(res.value, 500)
      assert.strictEqual(res.baseValue, 500)
      assert.strictEqual(res.baseUnit, 'g')
    })

    test('normalizes 1 kg to 1000 g', () => {
      const res = normalizeNetQuantity('1 kg')
      assert.strictEqual(res.unit, 'kg')
      assert.strictEqual(res.baseValue, 1000)
      assert.strictEqual(res.baseUnit, 'g')
    })

    test('normalizes 0.5 kg to 500 g', () => {
      const res = normalizeNetQuantity('0.5 kg')
      assert.strictEqual(res.unit, 'kg')
      assert.strictEqual(res.baseValue, 500)
      assert.strictEqual(res.baseUnit, 'g')
    })

    test('normalizes volume (L to mL)', () => {
      const res = normalizeNetQuantity('1 L')
      assert.strictEqual(res.quantityKind, QUANTITY_KINDS.VOLUME)
      assert.strictEqual(res.unit, 'L')
      assert.strictEqual(res.baseValue, 1000)
      assert.strictEqual(res.baseUnit, 'mL')
    })

    test('normalizes volume (ml)', () => {
      const res = normalizeNetQuantity('250 ml')
      assert.strictEqual(res.unit, 'mL')
      assert.strictEqual(res.baseValue, 250)
      assert.strictEqual(res.baseUnit, 'mL')
    })

    test('normalizes number/count', () => {
      const res = normalizeNetQuantity('10 pcs')
      assert.strictEqual(res.quantityKind, QUANTITY_KINDS.NUMBER)
      assert.strictEqual(res.unit, 'unit')
      assert.strictEqual(res.baseValue, 10)
    })

    test('handles unknown units gracefully', () => {
      const res = normalizeNetQuantity('500 unknown')
      assert.strictEqual(res.quantityKind, QUANTITY_KINDS.UNKNOWN)
      assert.strictEqual(res.baseValue, null)
    })

    test('handles malformed numbers', () => {
      const res = normalizeNetQuantity('abc kg')
      assert.strictEqual(res.quantityKind, QUANTITY_KINDS.UNKNOWN)
      assert.strictEqual(res.value, null)
    })

    test('handles missing or empty string', () => {
      const res1 = normalizeNetQuantity(null)
      assert.strictEqual(res1.quantityKind, QUANTITY_KINDS.UNKNOWN)
      
      const res2 = normalizeNetQuantity('   ')
      assert.strictEqual(res2.quantityKind, QUANTITY_KINDS.UNKNOWN)
    })
  })

  describe('Validation', () => {
    test('valid quantity passes validation', () => {
      const res = normalizeNetQuantity('500 g')
      const valid = validateQuantity(res)
      assert.strictEqual(valid.valid, true)
    })

    test('negative quantity fails validation', () => {
      const res = normalizeNetQuantity('-50 g')
      const valid = validateQuantity(res)
      assert.strictEqual(valid.valid, false)
      assert.strictEqual(valid.reason, 'ZERO_OR_NEGATIVE_VALUE')
    })

    test('zero quantity fails validation', () => {
      const res = normalizeNetQuantity('0 g')
      const valid = validateQuantity(res)
      assert.strictEqual(valid.valid, false)
      assert.strictEqual(valid.reason, 'ZERO_OR_NEGATIVE_VALUE')
    })

    test('unknown unit fails validation', () => {
      const res = normalizeNetQuantity('500 xyz')
      const valid = validateQuantity(res)
      assert.strictEqual(valid.valid, false)
      assert.strictEqual(valid.reason, 'UNKNOWN_UNIT')
    })

    test('invalid number fails validation', () => {
      const res = normalizeNetQuantity('abc kg')
      const valid = validateQuantity(res)
      assert.strictEqual(valid.valid, false)
      assert.strictEqual(valid.reason, 'UNKNOWN_UNIT') 
    })
  })
})
