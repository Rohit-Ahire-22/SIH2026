/**
 * Stage 7.14.1 — Per-User Product Ownership Security Regression Tests
 *
 * Covers all 13 test cases specified in the stage spec:
 *  1. User A creates product → receives it back
 *  2. User A can retrieve product by ID
 *  3. User A can run analysis on their product
 *  4. User A can access PDF report for their product
 *  5. User B cannot retrieve User A's product (→ 404)
 *  6. User B cannot upload image to User A's product (→ 404)
 *  7. User B cannot run OCR on User A's product (→ 404)
 *  8. User B cannot run analysis on User A's product (→ "Product not found")
 *  9. User B cannot retrieve PDF report of User A's product (→ "Product not found")
 * 10. User B cannot retrieve DOCX report of User A's product (→ "Product not found")
 * 11. User B's product list does not include User A's products
 * 12. Analytics do not leak cross-user products
 * 13. Unauthenticated requests are rejected (401)
 *
 * All tests use disposable mock users and products — no real credentials.
 */

import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'

import {
  createProduct,
  listProducts,
  getProduct,
  getAnalytics,
  uploadProductImage,
} from '../src/controllers/productController.js'
import { runProductOcr, runHybridProductOcr } from '../src/controllers/ocrController.js'
import { runProductAnalysis } from '../src/controllers/analysisController.js'
import { generatePdfReport, generateDocxReport } from '../src/controllers/reportController.js'
import { ReportService } from '../src/services/reportService.js'
import { AnalysisOrchestrationService } from '../src/services/analysisOrchestrationService.js'
import Product from '../src/models/Product.js'
import mongoose from 'mongoose'

// ───────────────────────────────────────────────────────────────────
// Disposable test fixture identities
// ───────────────────────────────────────────────────────────────────
const USER_A_ID = new mongoose.Types.ObjectId().toString()
const USER_B_ID = new mongoose.Types.ObjectId().toString()
const PRODUCT_A_ID = new mongoose.Types.ObjectId().toString()

// A minimal mock product owned by User A
const PRODUCT_A = {
  _id: PRODUCT_A_ID,
  id: PRODUCT_A_ID,
  userId: USER_A_ID,
  productName: 'Test Product Alpha',
  brandName: 'TestBrand',
  mrp: 100,
  netQuantity: { value: 500, unit: 'g' },
  images: [{ url: 'https://example.com/img.jpg', publicId: 'pub1', mimeType: 'image/jpeg' }],
  ocrResults: [],
  analysisStatus: 'COMPLETED',
  complianceStatus: 'COMPLIANT',
  complianceDetails: {},
  save: mock.fn(async () => {}),
}

// ───────────────────────────────────────────────────────────────────
// Mock req/res factory
// ───────────────────────────────────────────────────────────────────
function makeReqRes({ userId = USER_A_ID, params = {}, query = {}, body = {}, file = null } = {}) {
  const req = {
    user: { userId },
    params,
    query,
    body,
    file,
  }
  const res = {
    _status: null,
    _json: null,
    status(val) { this._status = val; return this },
    json(val) { this._json = val; return this },
    setHeader() {},
    end() {},
  }
  const next = mock.fn()
  return { req, res, next }
}

// ───────────────────────────────────────────────────────────────────
// Ownership security tests
// ───────────────────────────────────────────────────────────────────
describe('M1 — Per-User Product Ownership Security', () => {

  // ─── Test 1: User A creates product ────────────────────────────
  test('1. User A creates a product and receives it back', async () => {
    mock.method(Product, 'create', async (data) => ({
      ...data,
      _id: PRODUCT_A_ID,
      id: PRODUCT_A_ID,
    }))

    const { req, res, next } = makeReqRes({
      userId: USER_A_ID,
      body: {
        productName: 'Test Alpha',
        mrp: 100,
        netQuantity: { value: 500, unit: 'g' },
      },
    })

    await createProduct(req, res, next)

    assert.equal(res._status, 201, 'Expected 201 Created')
    assert.equal(res._json.success, true)
    assert.equal(res._json.data.userId, USER_A_ID, 'Product must carry owner userId')
    assert.equal(next.mock.callCount(), 0, 'next() must not be called on success')

    mock.restoreAll()
  })

  // ─── Test 2: User A retrieves their own product ─────────────────
  test('2. User A can retrieve their own product by ID', async () => {
    // findOne returns product only when queried with correct userId
    mock.method(Product, 'findOne', async ({ _id, userId }) => {
      if (_id === PRODUCT_A_ID && userId === USER_A_ID) return PRODUCT_A
      return null
    })

    const { req, res, next } = makeReqRes({
      userId: USER_A_ID,
      params: { id: PRODUCT_A_ID },
    })

    await getProduct(req, res, next)

    assert.equal(res._status, 200)
    assert.equal(res._json.success, true)
    assert.equal(res._json.data._id, PRODUCT_A_ID)

    mock.restoreAll()
  })

  // ─── Test 3: User A can analyze their own product ───────────────
  test('3. User A can run analysis on their own product', async () => {
    mock.method(AnalysisOrchestrationService, 'runFullAnalysis', async (productId, userId) => {
      assert.equal(productId, PRODUCT_A_ID)
      assert.equal(userId, USER_A_ID)
      return {
        id: PRODUCT_A_ID,
        analysisStatus: 'COMPLETED',
        complianceStatus: 'COMPLIANT',
        complianceDetails: {},
        mrp: 100,
        netQuantity: { value: 500, unit: 'g' },
        batchLotNumber: null,
        dateOfManufacture: null,
        dateOfPacking: null,
        expiryOrUseByDate: null,
        countryOfOrigin: null,
        manufacturerName: null,
        consumerCareDetails: {},
        category: 'food',
        categoryConfidence: 0.9,
        categoryDetectionStatus: 'DETECTED',
      }
    })

    const { req, res, next } = makeReqRes({
      userId: USER_A_ID,
      params: { id: PRODUCT_A_ID },
    })

    await runProductAnalysis(req, res, next)

    assert.equal(res._status, 200)
    assert.equal(res._json.success, true)
    assert.equal(res._json.data.complianceStatus, 'COMPLIANT')

    mock.restoreAll()
  })

  // ─── Test 4: User A can access PDF report ───────────────────────
  test('4. User A can access PDF report of their own product', async () => {
    const fakeReportDto = {
      metadata: { reportId: 'RPT-001' },
    }

    mock.method(ReportService, 'getReportDto', async (productId, userId) => {
      assert.equal(productId, PRODUCT_A_ID)
      assert.equal(userId, USER_A_ID)
      return fakeReportDto
    })

    // Patch PDF generator
    const { ReportPdfGenerator } = await import('../src/services/reportPdfGenerator.js')
    mock.method(ReportPdfGenerator, 'generate', async () => Buffer.from('fake-pdf'))

    const resMock = {
      _headers: {},
      _ended: false,
      setHeader(k, v) { this._headers[k] = v },
      end(buf) { this._ended = true; this._buf = buf },
      status(v) { this._status = v; return this },
      json(v) { this._json = v; return this },
    }

    const req = { user: { userId: USER_A_ID }, params: { id: PRODUCT_A_ID } }
    const next = mock.fn()

    await generatePdfReport(req, resMock, next)

    assert.equal(resMock._ended, true, 'PDF response must complete')
    assert.equal(next.mock.callCount(), 0)

    mock.restoreAll()
  })

  // ─── Test 5: User B CANNOT retrieve User A's product ────────────
  test('5. User B cannot retrieve User A\'s product — gets 404', async () => {
    mock.method(Product, 'findOne', async ({ _id, userId }) => {
      // Ownership enforced: B's userId does not match A's product
      if (_id === PRODUCT_A_ID && userId === USER_B_ID) return null
      if (_id === PRODUCT_A_ID && userId === USER_A_ID) return PRODUCT_A
      return null
    })

    const { req, res, next } = makeReqRes({
      userId: USER_B_ID,          // User B's identity
      params: { id: PRODUCT_A_ID }, // User A's product ID
    })

    await getProduct(req, res, next)

    assert.equal(res._status, 404, 'User B must receive 404 for User A\'s product')
    assert.equal(res._json.success, false)
    // Must not leak product data
    assert.equal(res._json.data, undefined, 'No product data must be leaked')

    mock.restoreAll()
  })

  // ─── Test 6: User B CANNOT upload image to User A's product ─────
  test('6. User B cannot upload image to User A\'s product — gets 404', async () => {
    mock.method(Product, 'findOne', async ({ _id, userId }) => {
      if (_id === PRODUCT_A_ID && userId === USER_B_ID) return null
      return PRODUCT_A
    })

    const { req, res, next } = makeReqRes({
      userId: USER_B_ID,
      params: { id: PRODUCT_A_ID },
      file: { buffer: Buffer.from('img'), originalname: 'img.jpg', mimetype: 'image/jpeg' },
    })

    await uploadProductImage(req, res, next)

    assert.equal(res._status, 404, 'User B must receive 404')
    assert.equal(res._json.success, false)

    mock.restoreAll()
  })

  // ─── Test 7: User B CANNOT run OCR on User A's product ──────────
  test('7. User B cannot run OCR on User A\'s product — gets 404', async () => {
    mock.method(Product, 'findOne', async ({ _id, userId }) => {
      if (_id === PRODUCT_A_ID && userId === USER_B_ID) return null
      return PRODUCT_A
    })

    const { req, res, next } = makeReqRes({
      userId: USER_B_ID,
      params: { id: PRODUCT_A_ID },
    })

    await runProductOcr(req, res, next)

    assert.equal(res._status, 404, 'User B must receive 404 for OCR')
    assert.equal(res._json.success, false)

    mock.restoreAll()
  })

  // ─── Test 7b: User B cannot run Hybrid OCR ──────────────────────
  test('7b. User B cannot run Hybrid OCR on User A\'s product — gets 404', async () => {
    mock.method(Product, 'findOne', async ({ _id, userId }) => {
      if (_id === PRODUCT_A_ID && userId === USER_B_ID) return null
      return PRODUCT_A
    })

    const { req, res, next } = makeReqRes({
      userId: USER_B_ID,
      params: { id: PRODUCT_A_ID },
    })

    await runHybridProductOcr(req, res, next)

    assert.equal(res._status, 404, 'User B must receive 404 for Hybrid OCR')
    assert.equal(res._json.success, false)

    mock.restoreAll()
  })

  // ─── Test 8: User B CANNOT run analysis on User A's product ─────
  test('8. User B cannot run analysis on User A\'s product — error propagates as 404', async () => {
    mock.method(AnalysisOrchestrationService, 'runFullAnalysis', async (productId, userId) => {
      // Simulates ownership-filtered lookup returning null → throws
      if (userId === USER_B_ID) {
        throw new Error(`Product not found: ${productId}`)
      }
      return {}
    })

    const { req, res, next } = makeReqRes({
      userId: USER_B_ID,
      params: { id: PRODUCT_A_ID },
    })

    await runProductAnalysis(req, res, next)

    assert.equal(res._status, 404, 'User B must receive 404 for analysis')
    assert.equal(res._json.success, false)
    assert.equal(next.mock.callCount(), 0, 'next() must not be called for ownership errors')

    mock.restoreAll()
  })

  // ─── Test 9: User B CANNOT get PDF report ───────────────────────
  test('9. User B cannot get PDF report for User A\'s product — gets 404', async () => {
    mock.method(ReportService, 'getReportDto', async (productId, userId) => {
      if (userId === USER_B_ID) {
        throw new Error(`Product not found with id: ${productId}`)
      }
      return { metadata: { reportId: 'RPT-001' } }
    })

    const resMock = {
      _status: null, _json: null,
      status(v) { this._status = v; return this },
      json(v) { this._json = v; return this },
      setHeader() {},
      end() {},
    }
    const req = { user: { userId: USER_B_ID }, params: { id: PRODUCT_A_ID } }
    const next = mock.fn()

    await generatePdfReport(req, resMock, next)

    assert.equal(resMock._status, 404, 'User B must receive 404 for PDF report')
    assert.equal(resMock._json.success, false)

    mock.restoreAll()
  })

  // ─── Test 10: User B CANNOT get DOCX report ─────────────────────
  test('10. User B cannot get DOCX report for User A\'s product — gets 404', async () => {
    mock.method(ReportService, 'getReportDto', async (productId, userId) => {
      if (userId === USER_B_ID) {
        throw new Error(`Product not found with id: ${productId}`)
      }
      return { metadata: { reportId: 'RPT-001' } }
    })

    const resMock = {
      _status: null, _json: null,
      status(v) { this._status = v; return this },
      json(v) { this._json = v; return this },
      setHeader() {},
      end() {},
    }
    const req = { user: { userId: USER_B_ID }, params: { id: PRODUCT_A_ID } }
    const next = mock.fn()

    await generateDocxReport(req, resMock, next)

    assert.equal(resMock._status, 404, 'User B must receive 404 for DOCX report')
    assert.equal(resMock._json.success, false)

    mock.restoreAll()
  })

  // ─── Test 11: User B's product list does not include A's products
  test("11. User B's product list does not include User A's products", async () => {
    const PRODUCT_B = {
      _id: new mongoose.Types.ObjectId().toString(),
      userId: USER_B_ID,
      productName: 'Product Beta',
    }

    // Simulate DB: find() scoped to userId
    mock.method(Product, 'find', (_query) => ({
      select: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => {
                // Only return products owned by the queried user
                const uid = _query.userId?.toString()
                if (uid === USER_B_ID) return [PRODUCT_B]
                if (uid === USER_A_ID) return [PRODUCT_A]
                return []
              }
            })
          })
        })
      })
    }))

    mock.method(Product, 'countDocuments', async (_query) => {
      const uid = _query.userId?.toString()
      if (uid === USER_B_ID) return 1
      if (uid === USER_A_ID) return 1
      return 0
    })

    // Request as User B
    const { req, res, next } = makeReqRes({ userId: USER_B_ID, query: {} })
    await listProducts(req, res, next)

    assert.equal(res._status, 200)
    assert.equal(res._json.success, true)

    const ids = res._json.data.map(p => p._id.toString())
    assert.ok(!ids.includes(PRODUCT_A_ID), 'Product A must not appear in User B\'s list')
    assert.equal(ids.length, 1)
    assert.equal(ids[0], PRODUCT_B._id)

    mock.restoreAll()
  })

  // ─── Test 12: Analytics do not leak cross-user data ─────────────
  test('12. Analytics do not leak another user\'s products', async () => {
    // Aggregate is always scoped to the requesting userId
    let capturedMatchStage = null

    mock.method(Product, 'aggregate', async (pipeline) => {
      const matchStage = pipeline.find(s => s.$match)
      if (matchStage) capturedMatchStage = matchStage.$match
      return []
    })

    const { req, res, next } = makeReqRes({ userId: USER_B_ID, query: { days: 'all' } })
    await getAnalytics(req, res, next)

    assert.equal(res._status, 200)
    assert.ok(capturedMatchStage !== null, 'Must have a $match stage')
    // The match stage must include userId scoped to User B
    const matchedUserId = capturedMatchStage.userId?.toString()
    assert.equal(matchedUserId, USER_B_ID, 'Analytics must be scoped to requesting user')

    mock.restoreAll()
  })

  // ─── Test 13: Unauthenticated requests are rejected ─────────────
  test('13. Unauthenticated requests to product endpoints get 401', async () => {
    const { authenticate } = await import('../src/middleware/authMiddleware.js')

    const req = { cookies: {}, headers: {} } // No token
    const res = {
      _status: null, _json: null,
      status(v) { this._status = v; return this },
      json(v) { this._json = v; return this },
    }
    const next = mock.fn()

    authenticate(req, res, next)

    assert.equal(res._status, 401, 'Must reject unauthenticated request with 401')
    assert.equal(res._json.success, false)
    assert.equal(next.mock.callCount(), 0, 'next() must not be called without valid token')
  })

  // ─── Test 13b: Malformed token rejected ─────────────────────────
  test('13b. Malformed JWT token is rejected with 401', async () => {
    process.env.JWT_SECRET = 'test-secret-for-ownership'
    const { authenticate } = await import('../src/middleware/authMiddleware.js')

    const req = {
      cookies: {},
      headers: { authorization: 'Bearer definitely.not.a.valid.jwt' },
    }
    const res = {
      _status: null, _json: null,
      status(v) { this._status = v; return this },
      json(v) { this._json = v; return this },
    }
    const next = mock.fn()

    authenticate(req, res, next)

    assert.equal(res._status, 401)
    assert.equal(res._json.success, false)
    assert.equal(next.mock.callCount(), 0)
  })

  // ─── Test: Invalid product ID (malformed ObjectId) is safe ──────
  test('14. Invalid product ObjectId returns 400 safely without DB query', async () => {
    // findOne should NOT be called for invalid IDs
    mock.method(Product, 'findOne', async () => {
      assert.fail('findOne must not be called for invalid ObjectId')
    })

    const { req, res, next } = makeReqRes({
      userId: USER_B_ID,
      params: { id: 'not-a-valid-object-id' },
    })

    await getProduct(req, res, next)

    assert.equal(res._status, 400, 'Invalid ObjectId must return 400')
    assert.equal(res._json.success, false)

    mock.restoreAll()
  })

})
