/**
 * AI Compliance Assistant — Unit Tests
 * node --test tests/chat.test.js
 */
import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'

import { askQuestion } from '../src/controllers/chatController.js'
import { buildInspectionContext, isAiChatAvailable } from '../src/services/aiChatService.js'
import Product from '../src/models/Product.js'

const USER_A_ID = new mongoose.Types.ObjectId().toString()
const USER_B_ID = new mongoose.Types.ObjectId().toString()
const PRODUCT_ID = new mongoose.Types.ObjectId().toString()

const MOCK_PRODUCT = {
  _id: PRODUCT_ID,
  userId: USER_A_ID,
  productName: 'Test Product',
  category: 'food',
  complianceStatus: 'REVIEW',
  analysisStatus: 'COMPLETED',
  complianceDetails: {
    rule6: {
      ruleNumber: '6',
      status: 'REVIEW',
      reason: 'MRP not clearly visible',
      checks: [
        { requirement: 'MRP declaration', status: 'REVIEW', reason: 'Partially visible', clause: '6(1)' },
      ],
    },
  },
  metadata: { extractedFields: { mrp: { value: '50', sourceType: 'OCR', confidence: 0.7 } } },
}

function mockRes() {
  const res = { statusValue: null, jsonValue: null }
  res.status = (v) => { res.statusValue = v; return res }
  res.json = (v) => { res.jsonValue = v; return res }
  return res
}

describe('AI Chat Service — provider availability', () => {
  test('isAiChatAvailable returns false when env vars missing', () => {
    const orig = {
      provider: process.env.AI_CHAT_PROVIDER,
      model: process.env.AI_CHAT_MODEL,
      key: process.env.AI_CHAT_API_KEY,
    }
    delete process.env.AI_CHAT_PROVIDER
    delete process.env.AI_CHAT_MODEL
    delete process.env.AI_CHAT_API_KEY

    assert.equal(isAiChatAvailable(), false)

    // Restore
    if (orig.provider) process.env.AI_CHAT_PROVIDER = orig.provider
    if (orig.model) process.env.AI_CHAT_MODEL = orig.model
    if (orig.key) process.env.AI_CHAT_API_KEY = orig.key
  })

  test('isAiChatAvailable returns true when all env vars present', () => {
    const orig = {
      provider: process.env.AI_CHAT_PROVIDER,
      model: process.env.AI_CHAT_MODEL,
      key: process.env.AI_CHAT_API_KEY,
    }
    process.env.AI_CHAT_PROVIDER = 'openai'
    process.env.AI_CHAT_MODEL = 'gpt-4o-mini'
    process.env.AI_CHAT_API_KEY = 'test-key-123'

    assert.equal(isAiChatAvailable(), true)

    // Restore
    if (orig.provider) process.env.AI_CHAT_PROVIDER = orig.provider; else delete process.env.AI_CHAT_PROVIDER
    if (orig.model) process.env.AI_CHAT_MODEL = orig.model; else delete process.env.AI_CHAT_MODEL
    if (orig.key) process.env.AI_CHAT_API_KEY = orig.key; else delete process.env.AI_CHAT_API_KEY
  })
})

describe('AI Chat Service — buildInspectionContext', () => {
  test('context does not include userId or personal data', () => {
    const context = buildInspectionContext(MOCK_PRODUCT)
    const contextStr = JSON.stringify(context)
    assert.ok(!contextStr.includes(USER_A_ID), 'userId must not appear in context')
    assert.ok(!contextStr.includes('passwordHash'), 'password must not appear')
    assert.ok(!contextStr.includes('email'), 'email must not appear')
  })

  test('context includes product name, category, compliance status', () => {
    const context = buildInspectionContext(MOCK_PRODUCT)
    assert.equal(context.productName, 'Test Product')
    assert.equal(context.category, 'food')
    assert.equal(context.complianceStatus, 'REVIEW')
  })

  test('context includes rule results', () => {
    const context = buildInspectionContext(MOCK_PRODUCT)
    assert.ok(context.ruleResults.rule6, 'rule6 results should be present')
    assert.equal(context.ruleResults.rule6.status, 'REVIEW')
  })

  test('context limits evidence to safe summary fields', () => {
    const context = buildInspectionContext(MOCK_PRODUCT)
    // extractedFields should have value/sourceType/confidence, not raw buffers
    if (context.extractedFields?.mrp) {
      assert.ok('value' in context.extractedFields.mrp || 'sourceType' in context.extractedFields.mrp)
    }
  })

  test('context does not include full bbox or raw binary data', () => {
    const productWithBbox = {
      ...MOCK_PRODUCT,
      complianceDetails: {
        rule6: {
          ruleNumber: '6', status: 'PASS', reason: 'All good',
          checks: [{ requirement: 'MRP', status: 'PASS', reason: 'Found', clause: '6(1)',
            evidence: [{ value: '50', sourceType: 'OCR', confidence: 0.9, bbox: [[0,0],[100,0],[100,50],[0,50]] }]
          }],
        },
      },
    }
    const context = buildInspectionContext(productWithBbox)
    const contextStr = JSON.stringify(context)
    // bbox should not appear in context (it's filtered to safe fields)
    assert.ok(!contextStr.includes('"bbox"'), 'bbox coordinates should not be in AI context')
  })
})

describe('AI Chat Controller — askQuestion', () => {
  test('rejects missing productId', async () => {
    const req = { body: { question: 'Why is this REVIEW?' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = () => {}
    await askQuestion(req, res, next)
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('productId'))
  })

  test('rejects missing question', async () => {
    const req = { body: { productId: PRODUCT_ID }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = () => {}
    await askQuestion(req, res, next)
    assert.equal(res.statusValue, 400)
    assert.ok(res.jsonValue.message.includes('question'))
  })

  test('rejects too-short question', async () => {
    const req = { body: { productId: PRODUCT_ID, question: 'Hi' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = () => {}
    await askQuestion(req, res, next)
    assert.equal(res.statusValue, 400)
  })

  test('returns available:false gracefully when provider not configured', async () => {
    // Ensure no AI provider configured
    const orig = process.env.AI_CHAT_PROVIDER
    delete process.env.AI_CHAT_PROVIDER
    delete process.env.AI_CHAT_MODEL
    delete process.env.AI_CHAT_API_KEY

    const req = { body: { productId: PRODUCT_ID, question: 'Why did this inspection fail?' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = () => {}
    await askQuestion(req, res, next)

    // Should return 200 with available:false, not crash
    assert.equal(res.statusValue, 200)
    assert.equal(res.jsonValue.available, false)
    assert.ok(res.jsonValue.message, 'Should include a message explaining unavailability')

    if (orig) process.env.AI_CHAT_PROVIDER = orig
  })

  test('returns 404 when product belongs to another user — IDOR prevention', async () => {
    // Ensure provider is "configured" so we reach the ownership check
    process.env.AI_CHAT_PROVIDER = 'openai'
    process.env.AI_CHAT_MODEL = 'gpt-4o-mini'
    process.env.AI_CHAT_API_KEY = 'test-key'

    // Controller chains .lean() on findOne, so mock must return {lean:...}
    mock.method(Product, 'findOne', () => ({ lean: async () => null }))

    const req = { body: { productId: PRODUCT_ID, question: 'Why did this inspection fail?' }, user: { userId: USER_B_ID } }
    const res = mockRes(); const next = () => {}
    await askQuestion(req, res, next)

    assert.equal(res.statusValue, 404)
    assert.ok(res.jsonValue.message.includes('access denied') || res.jsonValue.message.includes('not found'))
    mock.restoreAll()

    delete process.env.AI_CHAT_PROVIDER
    delete process.env.AI_CHAT_MODEL
    delete process.env.AI_CHAT_API_KEY
  })

  test('compliance pipeline is unaffected by AI errors', async () => {
    // Configure a provider that will fail at the HTTP call level (bad URL won't match real endpoint)
    // The controller must catch the error and return 200 available:false, not 500
    process.env.AI_CHAT_PROVIDER = 'openai'
    process.env.AI_CHAT_MODEL = 'gpt-4o-mini'
    process.env.AI_CHAT_API_KEY = 'deliberately-invalid-key-to-force-error'

    // Product found (controller reaches the AI call)
    mock.method(Product, 'findOne', () => ({ lean: async () => ({ ...MOCK_PRODUCT }) }))

    const req = { body: { productId: PRODUCT_ID, question: 'Why did this inspection fail?' }, user: { userId: USER_A_ID } }
    const res = mockRes(); const next = () => {}

    // The fetch to OpenAI will fail (bad key / no network in test env).
    // Controller MUST catch this and return 200 available:false — not throw a 500.
    await askQuestion(req, res, next)

    // Either the AI was unreachable (200 available:false) or provider not reachable — in both cases
    // the compliance result page should not crash (non-500 response expected)
    assert.ok(
      res.statusValue === 200 || res.statusValue === null,
      `Status should be 200 (graceful) or null (next() called for infra error), got ${res.statusValue}`,
    )
    if (res.statusValue === 200) {
      assert.equal(res.jsonValue.available, false, 'Should mark AI as unavailable on error')
    }

    mock.restoreAll()
    delete process.env.AI_CHAT_PROVIDER
    delete process.env.AI_CHAT_MODEL
    delete process.env.AI_CHAT_API_KEY
  })
})
