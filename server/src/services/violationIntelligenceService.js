import Product from '../models/Product.js'

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
 * @param {object} filters - { status, category, from, to }
 */
export async function getMapData(userId, filters = {}) {
  const query = { userId, 'location.latitude': { $exists: true } }

  if (filters.status) query.complianceStatus = filters.status
  if (filters.category) query.category = filters.category
  if (filters.from || filters.to) {
    query.createdAt = {}
    if (filters.from) query.createdAt.$gte = new Date(filters.from)
    if (filters.to) query.createdAt.$lte = new Date(filters.to)
  }

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
  }))
}

/**
 * Returns aggregate summary statistics for the violation intelligence dashboard.
 * Includes all products (with and without location).
 *
 * @param {string} userId
 * @param {object} filters - { from, to }
 */
export async function getAreaSummary(userId, filters = {}) {
  const matchStage = { userId: { $eq: userId } }

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
