import mongoose from 'mongoose'
import Product from '../models/Product.js'
import {
  getMapData,
  getAreaSummary,
  getHighAttentionAreas,
} from '../services/violationIntelligenceService.js'

/**
 * PATCH /api/products/:id/location
 * Sets or updates the optional location for an existing product/inspection.
 * Product ownership is enforced.
 * Location does NOT affect compliance analysis.
 */
export async function updateProductLocation(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user.userId

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `Invalid product id: ${id}` })
    }

    const { latitude, longitude, accuracy, source } = req.body

    // Validate required coordinates
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'latitude and longitude are required',
      })
    }

    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: 'latitude must be a number between -90 and 90',
      })
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'longitude must be a number between -180 and 180',
      })
    }

    if (!source || !['GPS', 'MANUAL'].includes(source)) {
      return res.status(400).json({
        success: false,
        message: 'source must be "GPS" or "MANUAL"',
      })
    }

    const locationData = {
      latitude: lat,
      longitude: lng,
      source,
      capturedAt: new Date(),
    }

    if (accuracy !== undefined) {
      const acc = parseFloat(accuracy)
      if (Number.isFinite(acc) && acc >= 0) {
        locationData.accuracy = acc
      }
    }

    // Ownership check
    const product = await Product.findOne({ _id: id, userId })
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or access denied',
      })
    }

    product.location = locationData
    await product.save()

    return res.status(200).json({
      success: true,
      message: 'Location recorded',
      data: { location: product.location },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/violations/map
 * Returns map marker data for inspections that have location coordinates.
 * Scoped to authenticated user (INSPECTOR sees own; ADMIN sees own — no cross-user leak).
 */
export async function getViolationMap(req, res, next) {
  try {
    const userId = req.user.userId
    const { status, category, from, to, manufacturer } = req.query

    const markers = await getMapData(userId, { status, category, from, to, manufacturer })

    return res.status(200).json({
      success: true,
      data: markers,
      meta: {
        count: markers.length,
        note: 'Inspection attention areas — not indicative of confirmed legal violations',
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/violations/high-attention
 * Returns clustered "high-attention areas" (cells with multiple inspections
 * including at least one NON_COMPLIANT or REVIEW). Empty when the data is
 * insufficient to infer a pattern.
 */
export async function getHighAttentionAreasController(req, res, next) {
  try {
    const userId = req.user.userId
    const { status, category, from, to, manufacturer } = req.query

    const { areas, hasHighAttentionData } = await getHighAttentionAreas(userId, {
      status,
      category,
      from,
      to,
      manufacturer,
    })

    return res.status(200).json({
      success: true,
      data: {
        areas,
        hasHighAttentionData,
        note: 'High-attention areas are based on stored inspection data — they are not confirmed legal violation zones.',
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/violations/summary
 * Returns aggregated inspection statistics for the violation dashboard.
 */
export async function getAreaSummaryController(req, res, next) {
  try {
    const userId = req.user.userId
    const { from, to } = req.query

    const summary = await getAreaSummary(userId, { from, to })

    return res.status(200).json({ success: true, data: summary })
  } catch (err) {
    return next(err)
  }
}
