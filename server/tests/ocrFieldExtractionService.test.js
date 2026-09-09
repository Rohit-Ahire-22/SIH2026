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

  assert.equal(fields.mrp.value, 250)
  assert.equal(fields.mrp.currency, 'INR')
  assert.equal(fields.mrp.evidence, 'MRP Rs 250.00')

  assert.deepEqual(fields.netQuantity.value, 500)
  assert.equal(fields.netQuantity.unit, 'g')
  assert.equal(fields.netQuantity.evidence, 'Net Quantity 500 g')

  assert.equal(fields.batchLotNumber.value, 'ABC123')
  assert.equal(fields.batchLotNumber.evidence, 'Batch: ABC123')

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

  assert.equal(fields.mrp.value, 129)
  assert.equal(fields.netQuantity.value, 1)
  assert.equal(fields.netQuantity.unit, 'kg')
  assert.equal(fields.batchLotNumber.value, 'XYZ789')
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

  assert.equal(fields.dateOfManufacture.value, '2025-08-15')
  assert.equal(fields.dateOfPacking.value, '2025-09-02')
  assert.equal(fields.expiryOrUseByDate.value, '2027-01-01') // It takes the first one matched, which is Use By or Best Before
  assert.equal(fields.countryOfOrigin.value, 'India')
  assert.equal(fields.manufacturerName.value, 'FoodCo Pvt Ltd')
  assert.deepEqual(fields.consumerCareDetails.value, {
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

  assert.equal(fields.expiryOrUseByDate.value, '2026-12-31')
  assert.equal(fields.countryOfOrigin.value, 'Bangladesh')
  assert.equal(fields.manufacturerName.value, 'ABC Foods Ltd')
})

test('Test 3c: MRP variants and unit variants', () => {
  assert.equal(extractProductFields(['M.R.P. Rs. 250']).mrp.value, 250)
  assert.equal(extractProductFields(['Maximum Retail Price Rs 250']).mrp.value, 250)
  
  const v1 = extractProductFields(['Net Weight 250 ml']).netQuantity
  assert.equal(v1.value, 250)
  assert.equal(v1.unit, 'ml')

  const v2 = extractProductFields(['Net Wt. 500 g']).netQuantity
  assert.equal(v2.value, 500)
  assert.equal(v2.unit, 'g')

  const v3 = extractProductFields(['Net Qty: 1 L']).netQuantity
  assert.equal(v3.value, 1)
  assert.equal(v3.unit, 'l')
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

test('Test 3e: "See Top/Seal" returns REVIEW instead of inventing', () => {
  const fields = extractProductFields([
    'MFD. & Batch No.: See Top/Seal',
  ])
  assert.equal(fields.dateOfManufacture.value, 'REVIEW')
  assert.equal(fields.batchLotNumber.value, 'REVIEW')
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
    brandName: null,
    productName: null
  })
})

test('Test 4b: accepts OCR result objects with .text', () => {
  const fields = extractProductFields([
    { text: 'MRP: ₹200', confidence: 0.99, bbox: [] },
    { text: 'Batch No: A1B2', confidence: 0.9, bbox: [] },
  ])

  assert.equal(fields.mrp.value, 200)
  assert.equal(fields.batchLotNumber.value, 'A1B2')
})

test('Test 5: MRP inclusive of all taxes', () => {
  const fields = extractProductFields([
    '*MRP20/-Incl.of all taxes',
  ])
  assert.equal(fields.mrp.value, 20)
  assert.equal(fields.mrp.inclusiveOfTaxes, true)
})

test('Test 6: Reject PIN code for phone number', () => {
  const fields = extractProductFields([
    'PO BOX 14760, MUMBAI 400099',
    'Customer Care: 400099'
  ])
  assert.equal(fields.consumerCareDetails, null)
})