import mongoose from 'mongoose'
import Product from '../models/Product.js'

// Aggregation pipelines do NOT auto-cast string userId to ObjectId the way
// .find() / .countDocuments() do. Convert explicitly so $match works.
function asObjectIdValue(value) {
  return mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : value
}

/**
 * Violation Intelligence Service
 *
 * Reads existing persisted inspection results and aggregates them
 * into location-aware intelligence data.
 *
 * IMPORTANT: This service does NOT recalculate compliance rules.
 * It reads complianceStatus, complianceDetails, and location as stored.
 */

/**
 * Returns map marker data for inspections that have location coordinates.
 * Only exposes non-sensitive aggregated inspection information.
 *
 * @param {string} userId
 * @param {object} filters - { status, category, from, to, manufacturer }
 */
export async function getMapData(userId, filters = {}) {
  const query = buildMapQuery(userId, filters)

  const products = await Product.find(query)
    .select(
      'productName category complianceStatus location createdAt _id brandName manufacturerName',
    )
    .sort({ createdAt: -1 })
    .limit(500) // Reasonable cap for map rendering
    .lean()

  return products.map((p) => ({
    productId: p._id,
    productName: p.productName,
    category: p.category,
    complianceStatus: p.complianceStatus,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    accuracy: p.location.accuracy,
    source: p.location.source,
    inspectionDate: p.createdAt,
    // Note: brand/manufacturer are standard label declarations — not private
    brandName: p.brandName,
    manufacturer: p.manufacturerName || null,
  }))
}

/**
 * Builds the shared map query with optional filters.
 * @param {string} userId
 * @param {object} filters
 */
export function buildMapQuery(userId, filters = {}) {
  const query = { userId, 'location.latitude': { $exists: true } }

  if (filters.status) query.complianceStatus = filters.status
  if (filters.category) query.category = filters.category
  if (filters.from || filters.to) {
    query.createdAt = {}
    if (filters.from) query.createdAt.$gte = new Date(filters.from)
    if (filters.to) query.createdAt.$lte = new Date(filters.to)
  }
  if (filters.manufacturer && String(filters.manufacturer).trim()) {
    const term = escapeRegExp(String(filters.manufacturer).trim())
    query.$or = [
      { brandName: { $regex: term, $options: 'i' } },
      { manufacturerName: { $regex: term, $options: 'i' } },
    ]
  }

  return query
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Grid cell size in degrees (~5.5 km at the equator) used to cluster
// inspections into attention areas.
export const AREA_GRID_DEGREES = 0.05

/**
 * Clusters geo-located inspections into grid cells and identifies
 * "high-attention areas" — cells with at least one NON_COMPLIANT or REVIEW
 * inspection AND at least two inspections total (so a single point doesn't
 * imply a pattern). Pure function — unit-tested without a database.
 *
 * @param {Array<{latitude:number, longitude:number, complianceStatus:string}>} products
 * @returns {{ areas: Array<object>, hasHighAttentionData: boolean }}
 */
export function computeHighAttentionAreas(products) {
  const cells = new Map()

  for (const p of products || []) {
    if (
      p.latitude === undefined || p.latitude === null ||
      p.longitude === undefined || p.longitude === null
    ) continue

    const lat = Number(p.latitude)
    const lng = Number(p.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const key = `${Math.round(lat / AREA_GRID_DEGREES)},${Math.round(lng / AREA_GRID_DEGREES)}`
    const cell = cells.get(key) || {
      key,
      count: 0,
      compliant: 0,
      nonCompliant: 0,
      review: 0,
      pending: 0,
      latSum: 0,
      lngSum: 0,
    }
    cell.count += 1
    cell.latSum += lat
    cell.lngSum += lng
    const status = p.complianceStatus
    if (status === 'COMPLIANT') cell.compliant += 1
    else if (status === 'NON_COMPLIANT') cell.nonCompliant += 1
    else if (status === 'REVIEW') cell.review += 1
    else cell.pending += 1
    cells.set(key, cell)
  }

  const areas = Array.from(cells.values())
    .filter((c) => c.count >= 2 && (c.nonCompliant + c.review) >= 1)
    .map((c) => {
      const attentionScore = c.nonCompliant + c.review
      return {
        center: { latitude: c.latSum / c.count, longitude: c.lngSum / c.count },
        count: c.count,
        compliant: c.compliant,
        nonCompliant: c.nonCompliant,
        review: c.review,
        pending: c.pending,
        attentionScore,
      }
    })
    .sort((a, b) => b.attentionScore - a.attentionScore || b.count - a.count)
    .slice(0, 10)

  return { areas, hasHighAttentionData: areas.length > 0 }
}

/**
 * Fetches high-attention areas for a user from persisted inspection data.
 *
 * @param {string} userId
 * @param {object} filters - { status, category, from, to, manufacturer }
 */
export async function getHighAttentionAreas(userId, filters = {}) {
  const query = buildMapQuery(userId, filters)

  const products = await Product.find(query)
    .select('complianceStatus location')
    .lean()

  return computeHighAttentionAreas(products)
}

/**
 * Returns aggregate summary statistics for the violation intelligence dashboard.
 * Includes all products (with and without location).
 *
 * @param {string} userId
 * @param {object} filters - { from, to }
 */
export async function getAreaSummary(userId, filters = {}) {
  const matchStage = { userId: { $eq: asObjectIdValue(userId) } }

  if (filters.from || filters.to) {
    matchStage.createdAt = {}
    if (filters.from) matchStage.createdAt.$gte = new Date(filters.from)
    if (filters.to) matchStage.createdAt.$lte = new Date(filters.to)
  }

  const [summaryResult, categoryResult, locationCount] = await Promise.all([
    Product.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          compliant: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'COMPLIANT'] }, 1, 0] } },
          nonCompliant: {
            $sum: { $cond: [{ $eq: ['$complianceStatus', 'NON_COMPLIANT'] }, 1, 0] },
          },
          review: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'REVIEW'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'PENDING'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]),

    Product.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          nonCompliant: {
            $sum: { $cond: [{ $eq: ['$complianceStatus', 'NON_COMPLIANT'] }, 1, 0] },
          },
          review: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'REVIEW'] }, 1, 0] } },
        },
      },
      { $sort: { nonCompliant: -1, review: -1 } },
    ]),

    Product.countDocuments({
      userId,
      'location.latitude': { $exists: true },
    }),
  ])

  return {
    summary: summaryResult[0] || {
      total: 0,
      compliant: 0,
      nonCompliant: 0,
      review: 0,
      pending: 0,
    },
    categoryBreakdown: categoryResult,
    inspectionsWithLocation: locationCount,
  }
}
