/**
 * Location Capture + Violation Intelligence — Unit Tests
 * node --test tests/location.test.js
 */
import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'

import { updateProductLocation } from '../src/controllers/locationController.js'
import Product from '../src/models/Product.js'

const USER_A_ID = new mongoose.Types.ObjectId().toString()
const USER_B_ID = new mongoose.Types.ObjectId().toString()
const PRODUCT_ID = new mongoose.Types.ObjectId().toString()

function mockRes() {
  const res = { statusValue: null, jsonValue: null }
  res.status = (v) => { res.statusValue = v; return res }
  res.json = (v) => { res.jsonValue = v; return res }
  return res
}

function mockNext() { const fn = (err) => { fn.arg = err }; return fn }

const BASE_PRODUCT = {
  _id: PRODUCT_ID,
  userId: USER_A_ID,
  productName: 'Test',
  complianceStatus: 'COMPLIANT',
  location: null,
  save: async function () { return this },
}

describe('Location Controller — updateProductLocation', () => {
  test('rejects invalid product id format', async () => {
    const req = { params: { id: 'bad-id' }, body: { latitude: 18.5, longitude: 73.8, source: 'GPS' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 400)
  })

  test('rejects missing latitude/longitude', async () => {
    const req = { params: { id: PRODUCT_ID }, body: { source: 'GPS' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('latitude'))
  })

  test('rejects out-of-range latitude', async () => {
    const req = { params: { id: PRODUCT_ID }, body: { latitude: 200, longitude: 73.8, source: 'GPS' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('latitude'))
  })

  test('rejects out-of-range longitude', async () => {
    const req = { params: { id: PRODUCT_ID }, body: { latitude: 18.5, longitude: 500, source: 'GPS' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('longitude'))
  })

  test('rejects invalid source value', async () => {
    const req = { params: { id: PRODUCT_ID }, body: { latitude: 18.5, longitude: 73.8, source: 'SATELLITE' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('source'))
  })

  test('returns 404 when product belongs to different user — IDOR prevention', async () => {
    mock.method(Product, 'findOne', async () => null) // User B cannot find User A's product
    const req = { params: { id: PRODUCT_ID }, body: { latitude: 18.5, longitude: 73.8, source: 'GPS' }, user: { userId: USER_B_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 404)
    assert.ok(res.jsonValue.message.includes('access denied') || res.jsonValue.message.includes('not found'))
    mock.restoreAll()
  })

  test('saves valid GPS location successfully', async () => {
    const product = { ...BASE_PRODUCT, location: null }
    mock.method(Product, 'findOne', async () => product)
    const req = {
      params: { id: PRODUCT_ID },
      body: { latitude: 18.5204, longitude: 73.8567, accuracy: 10, source: 'GPS' },
      user: { userId: USER_A_ID },
    }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 200)
    assert.equal(res.jsonValue.success, true)
    assert.equal(product.location.latitude, 18.5204)
    assert.equal(product.location.source, 'GPS')
    assert.ok(product.location.capturedAt instanceof Date)
    mock.restoreAll()
  })

  test('saves valid MANUAL location successfully', async () => {
    const product = { ...BASE_PRODUCT, location: null }
    mock.method(Product, 'findOne', async () => product)
    const req = {
      params: { id: PRODUCT_ID },
      body: { latitude: 28.6139, longitude: 77.2090, source: 'MANUAL' },
      user: { userId: USER_A_ID },
    }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 200)
    assert.equal(product.location.source, 'MANUAL')
    mock.restoreAll()
  })

  test('location does NOT affect compliance status', async () => {
    const product = { ...BASE_PRODUCT, complianceStatus: 'NON_COMPLIANT', location: null }
    mock.method(Product, 'findOne', async () => product)
    const req = {
      params: { id: PRODUCT_ID },
      body: { latitude: 18.5, longitude: 73.8, source: 'GPS' },
      user: { userId: USER_A_ID },
    }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    // Compliance status must remain unchanged
    assert.equal(product.complianceStatus, 'NON_COMPLIANT')
    mock.restoreAll()
  })

  test('products without location continue to work (missing location compat)', async () => {
    // Product with no location field at all — simulates existing records
    const product = { _id: PRODUCT_ID, userId: USER_A_ID, productName: 'Old Product', complianceStatus: 'COMPLIANT', save: async function () { return this } }
    mock.method(Product, 'findOne', async () => product)
    const req = {
      params: { id: PRODUCT_ID },
      body: { latitude: 18.5, longitude: 73.8, source: 'MANUAL' },
      user: { userId: USER_A_ID },
    }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 200)
    assert.ok(product.location, 'Location should be set on product')
    mock.restoreAll()
  })
})

describe('Violation Intelligence — coordinate boundary checks', () => {
  test('latitude exactly at boundary -90 is accepted', async () => {
    const product = { ...BASE_PRODUCT, location: null }
    mock.method(Product, 'findOne', async () => product)
    const req = { params: { id: PRODUCT_ID }, body: { latitude: -90, longitude: 0, source: 'MANUAL' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 200)
    mock.restoreAll()
  })

  test('latitude exactly at boundary 90 is accepted', async () => {
    const product = { ...BASE_PRODUCT, location: null }
    mock.method(Product, 'findOne', async () => product)
    const req = { params: { id: PRODUCT_ID }, body: { latitude: 90, longitude: 0, source: 'MANUAL' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 200)
    mock.restoreAll()
  })

  test('non-numeric latitude is rejected', async () => {
    const req = { params: { id: PRODUCT_ID }, body: { latitude: 'abc', longitude: 73.8, source: 'GPS' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = mockNext()
    await updateProductLocation(req, res, next)
    assert.equal(res.statusValue, 400)
  })
})
