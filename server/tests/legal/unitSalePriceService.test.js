import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeUnitSalePriceBasis,
  classifyQuantityKind,
  describeUnitSalePriceBasis,
} from '../../src/legal/compliance/unitSalePriceService.js'
import { APPLICABILITY_STATUS } from '../../src/legal/compliance/complianceTypes.js'

const { APPLICABLE, REVIEW } = APPLICABILITY_STATUS

function expectBasis(netQuantity, packageType, basisUnit, basisQuantity) {
  const result = computeUnitSalePriceBasis({ netQuantity, packageType })
  assert.equal(result.status, APPLICABLE)
  assert.equal(result.basisUnit, basisUnit)
  assert.equal(result.basisQuantity, basisQuantity)
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0)
  assert.deepEqual(result.todos, [])
  return result
}

function expectReview(netQuantity, packageType) {
  const result = computeUnitSalePriceBasis({ netQuantity, packageType })
  assert.equal(result.status, REVIEW)
  return result
}

test('Test 12: Unit-sale-price mass basis — below 1 kg is per gram', () => {
  expectBasis({ value: 500, unit: 'g' }, 'STANDARD', 'gram', 500)
  expectBasis({ value: 0.75, unit: 'kg' }, 'STANDARD', 'gram', 750)
})

test('Test 12b: Unit-sale-price mass basis — above 1 kg is per kilogram', () => {
  expectBasis({ value: 2, unit: 'kg' }, 'STANDARD', 'kilogram', 2)
  expectBasis({ value: 1250, unit: 'g' }, 'STANDARD', 'kilogram', 1.25)
})

test('Test 13: Unit-sale-price volume basis', () => {
  expectBasis({ value: 200, unit: 'ml' }, 'STANDARD', 'millilitre', 200)
  expectBasis({ value: 1.5, unit: 'l' }, 'STANDARD', 'litre', 1.5)
  expectBasis({ value: 0.9, unit: 'L' }, 'STANDARD', 'millilitre', 900)
})

test('Test 14: Unit-sale-price length basis', () => {
  expectBasis({ value: 30, unit: 'cm' }, 'STANDARD', 'centimetre', 30)
  expectBasis({ value: 2, unit: 'm' }, 'STANDARD', 'metre', 2)
})

test('Test 15: Number-based quantity is per unit/number', () => {
  expectBasis({ value: 12, unit: 'pcs' }, 'STANDARD', 'unit', 12)
  expectBasis({ value: 6, unit: 'nos' }, 'STANDARD', 'unit', 6)
  assert.equal(classifyQuantityKind('each'), 'count')
  assert.equal(classifyQuantityKind('gal'), 'UNKNOWN')
})

test('Boundary exactly 1 kg is REVIEW, never assumed', () => {
  const result = expectReview({ value: 1, unit: 'kg' }, 'STANDARD')
  assert.ok(result.todos.length > 0)
  assert.match(result.reason, /boundar/i)
})

test('Unknown or missing unit/quantity is REVIEW', () => {
  expectReview({ value: 10, unit: 'gal' }, 'STANDARD')
  expectReview({ value: null, unit: 'g' }, 'STANDARD')
  expectReview({ value: 0, unit: 'g' }, 'STANDARD')
  expectReview({ value: -2, unit: 'kg' }, 'STANDARD')
  expectReview(undefined, 'STANDARD')
})

test('Test 16: COMBINATION / GROUP / MULTI_PIECE return REVIEW with an official-amendment TODO', () => {
  for (const packageType of ['COMBINATION', 'GROUP', 'MULTI_PIECE']) {
    const result = expectReview({ value: 500, unit: 'g' }, packageType)
    assert.ok(result.todos.length > 0)
    assert.match(result.reason, /official/i)
    assert.match(result.reason, /amendment/i)
  }
  // STANDARD packages of identical quantity are not auto-exempted.
  const check = computeUnitSalePriceBasis({ netQuantity: { value: 500, unit: 'g' }, packageType: 'STANDARD' })
  assert.equal(check.status, APPLICABLE)
})

test('describeUnitSalePriceBasis renders a human-safe deterministic string', () => {
  const result = computeUnitSalePriceBasis({ netQuantity: { value: 500, unit: 'g' }, packageType: 'STANDARD' })
  assert.match(describeUnitSalePriceBasis(result), /per gram/)
  const review = expectReview({ value: 1, unit: 'kg' }, 'STANDARD')
  assert.equal(describeUnitSalePriceBasis(review), review.reason)
})