import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractProductFields } from '../src/services/ocrFieldExtractionService.js'

test('Test 1: MRP, net quantity, batch', () => {
  const fields = extractProductFields([
    'PACKAGED COMMODITY',
    'MRP Rs 250.00',
    'Net Quantity 500 g',
    'Batch: ABC123',
  ])

  assert.equal(fields.mrp, 250)
  assert.deepEqual(fields.netQuantity, { value: 500, unit: 'g' })
  assert.equal(fields.batchLotNumber, 'ABC123')
  assert.equal(fields.dateOfManufacture, null)
  assert.equal(fields.dateOfPacking, null)
  assert.equal(fields.expiryOrUseByDate, null)
  assert.equal(fields.countryOfOrigin, null)
  assert.equal(fields.manufacturerName, null)
  assert.equal(fields.consumerCareDetails, null)
})

test('Test 2: rupee symbol, kg unit, lot number', () => {
  const fields = extractProductFields([
    'MRP: ₹129',
    'Net Qty: 1 kg',
    'Lot No: XYZ789',
  ])

  assert.equal(fields.mrp, 129)
  assert.deepEqual(fields.netQuantity, { value: 1, unit: 'kg' })
  assert.equal(fields.batchLotNumber, 'XYZ789')
})

test('Test 3: dates, country, manufacturer, consumer care', () => {
  const fields = extractProductFields([
    'Mfg Date: 15/08/2025',
    'Date of Packing: 02-09-2025',
    'Use By: 01/2027',
    'Best Before: 31.12.2026',
    'Country of Origin: India',
    'Manufactured & Marketed by: FoodCo Pvt Ltd',
    'Consumer Care: Toll Free 1800-123-4567 care@foodco.in',
  ])

  assert.equal(fields.dateOfManufacture, '2025-08-15')
  assert.equal(fields.dateOfPacking, '2025-09-02')
  assert.equal(fields.expiryOrUseByDate, '2027-01-01')
  assert.equal(fields.countryOfOrigin, 'India')
  assert.equal(fields.manufacturerName, 'FoodCo Pvt Ltd')
  assert.deepEqual(fields.consumerCareDetails, {
    phone: '1800-123-4567',
    email: 'care@foodco.in',
  })
})

test('Test 3b: best-before dot format, made-in, mfd by', () => {
  const fields = extractProductFields([
    'Best Before: 31.12.2026',
    'Made in: Bangladesh',
    'Mfd by: ABC Foods Ltd',
  ])

  assert.equal(fields.expiryOrUseByDate, '2026-12-31')
  assert.equal(fields.countryOfOrigin, 'Bangladesh')
  assert.equal(fields.manufacturerName, 'ABC Foods Ltd')
})

test('Test 3c: MRP variants and unit variants', () => {
  assert.equal(extractProductFields(['M.R.P. Rs. 250']).mrp, 250)
  assert.equal(extractProductFields(['Maximum Retail Price Rs 250']).mrp, 250)
  assert.deepEqual(extractProductFields(['Net Weight 250 ml']).netQuantity, {
    value: 250,
    unit: 'ml',
  })
  assert.deepEqual(extractProductFields(['Net Wt. 500 g']).netQuantity, {
    value: 500,
    unit: 'g',
  })
  assert.deepEqual(extractProductFields(['Net Qty: 1 L']).netQuantity, {
    value: 1,
    unit: 'l',
  })
})

test('Test 3d: no invented dates when parsing is not confident', () => {
  const fields = extractProductFields([
    'MFD: 2025',
    'Expiry: 32/13/2025',
    'Use By: tomorrow',
  ])

  assert.equal(fields.dateOfManufacture, null)
  assert.equal(fields.expiryOrUseByDate, null)
})

test('Test 4: unrecognizable OCR text yields no invented values', () => {
  const fields = extractProductFields([
    'Unrelated text 1234',
    '',
    'Warranty 1 year',
  ])

  assert.deepEqual(fields, {
    mrp: null,
    netQuantity: null,
    batchLotNumber: null,
    dateOfManufacture: null,
    dateOfPacking: null,
    expiryOrUseByDate: null,
    countryOfOrigin: null,
    manufacturerName: null,
    consumerCareDetails: null,
  })
})

test('Test 4b: accepts OCR result objects with .text', () => {
  const fields = extractProductFields([
    { text: 'MRP: ₹200', confidence: 0.99, bbox: [] },
    { text: 'Batch No: A1B2', confidence: 0.9, bbox: [] },
  ])

  assert.equal(fields.mrp, 200)
  assert.equal(fields.batchLotNumber, 'A1B2')
})