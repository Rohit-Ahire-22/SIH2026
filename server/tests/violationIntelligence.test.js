/**
 * Violation Intelligence — Unit Tests
 * node --test tests/violationIntelligence.test.js
 *
 * Pure helpers (computeHighAttentionAreas, buildMapQuery) tested without a DB.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMapQuery,
  computeHighAttentionAreas,
  AREA_GRID_DEGREES,
} from '../src/services/violationIntelligenceService.js'

const USER_ID = '64f2a1b2c3d4e5f6a7b8c9d0'

describe('buildMapQuery — filter composition', () => {
  test('base query only requires userId and location', () => {
    const q = buildMapQuery(USER_ID, {})
    assert.equal(q.userId, USER_ID)
    assert.ok(q['location.latitude'].$exists)
  })

  test('adds status, category and date filters', () => {
    const q = buildMapQuery(USER_ID, { status: 'REVIEW', category: 'food', from: '2026-01-01', to: '2026-02-01' })
    assert.equal(q.complianceStatus, 'REVIEW')
    assert.equal(q.category, 'food')
    assert.ok(q.createdAt.$gte instanceof Date)
    assert.ok(q.createdAt.$lte instanceof Date)
  })

  test('adds manufacturer $or with brandName and manufacturerName', () => {
    const q = buildMapQuery(USER_ID, { manufacturer: 'ACME' })
    assert.ok(Array.isArray(q.$or))
    assert.equal(q.$or.length, 2)
    assert.ok(q.$or[0].brandName.$options === 'i')
    assert.ok(q.$or[1].manufacturerName.$options === 'i')
  })

  test('escapes regex metacharacters in manufacturer filter', () => {
    const q = buildMapQuery(USER_ID, { manufacturer: 'AC.ME (Pvt)' })
    assert.equal(q.$or[0].brandName.$regex, 'AC\\.ME \\(Pvt\\)')
  })

  test('ignores blank manufacturer filter', () => {
    const q = buildMapQuery(USER_ID, { manufacturer: '   ' })
    assert.equal(q.$or, undefined)
  })

  test('does not leak userId across different callers', () => {
    const q = buildMapQuery(USER_ID, { status: 'NON_COMPLIANT' })
    assert.equal(q.userId, USER_ID)
  })
})

describe('computeHighAttentionAreas — grid clustering', () => {
  const inCell = (lat, lng, status) => ({ latitude: lat, longitude: lng, complianceStatus: status })

  test('empty input yields no areas and hasHighAttentionData=false', () => {
    const r = computeHighAttentionAreas([])
    assert.deepEqual(r, { areas: [], hasHighAttentionData: false })
  })

  test('a single inspection never forms a high-attention area', () => {
    const r = computeHighAttentionAreas([inCell(28.6139, 77.2090, 'NON_COMPLIANT')])
    assert.equal(r.areas.length, 0)
    assert.equal(r.hasHighAttentionData, false)
  })

  test('clusters a cell with NC + review + compliant into one attention area', () => {
    // All roughly within the same 0.05° cell near Delhi.
    const products = [
      inCell(28.6139, 77.2090, 'NON_COMPLIANT'),
      inCell(28.6201, 77.2202, 'REVIEW'),
      inCell(28.6155, 77.2150, 'COMPLIANT'),
    ]
    const r = computeHighAttentionAreas(products)
    assert.equal(r.hasHighAttentionData, true)
    assert.equal(r.areas.length, 1)
    assert.equal(r.areas[0].count, 3)
    assert.equal(r.areas[0].nonCompliant, 1)
    assert.equal(r.areas[0].review, 1)
    assert.equal(r.areas[0].compliant, 1)
    assert.equal(r.areas[0].attentionScore, 2)
    assert.ok(r.areas[0].center.latitude > 28.6 && r.areas[0].center.latitude < 28.62)
  })

  test('all-compliant cells are NOT high-attention areas', () => {
    const products = [
      inCell(28.6139, 77.2090, 'COMPLIANT'),
      inCell(28.6201, 77.2202, 'COMPLIANT'),
    ]
    const r = computeHighAttentionAreas(products)
    assert.equal(r.areas.length, 0)
    assert.equal(r.hasHighAttentionData, false)
  })

  test('separates distinct grid cells', () => {
    const products = [
      inCell(28.6139, 77.2090, 'NON_COMPLIANT'),
      inCell(28.6201, 77.2202, 'REVIEW'), // same cell as above
      inCell(19.0760, 72.8777, 'NON_COMPLIANT'), // Mumbai
      inCell(19.0800, 72.8900, 'REVIEW'), // same Mumbai cell
    ]
    const r = computeHighAttentionAreas(products)
    assert.equal(r.areas.length, 2)
  })

  test('sorts areas by attentionScore descending', () => {
    const clusterA = [
      inCell(28.6139, 77.2090, 'NON_COMPLIANT'),
      inCell(28.6150, 77.2110, 'NON_COMPLIANT'),
      inCell(28.6160, 77.2120, 'NON_COMPLIANT'),
    ]
    const clusterB = [
      inCell(19.0760, 72.8777, 'NON_COMPLIANT'),
      inCell(19.0800, 72.8900, 'REVIEW'),
    ]
    const r = computeHighAttentionAreas([...clusterA, ...clusterB])
    assert.equal(r.areas.length, 2)
    assert.ok(r.areas[0].attentionScore >= r.areas[1].attentionScore)
  })

  test('skips products with invalid or missing coordinates', () => {
    const products = [
      inCell(28.6139, 77.2090, 'NON_COMPLIANT'),
      inCell(null, 77.2090, 'REVIEW'),
      { latitude: 'invalid', longitude: 1, complianceStatus: 'REVIEW' },
      {},
    ]
    const r = computeHighAttentionAreas(products)
    assert.equal(r.hasHighAttentionData, false)
    assert.equal(r.areas.length, 0)
  })

  test('uses AREA_GRID_DEGREES for cell bucketing', () => {
    assert.ok(AREA_GRID_DEGREES > 0 && AREA_GRID_DEGREES < 1)
  })
})