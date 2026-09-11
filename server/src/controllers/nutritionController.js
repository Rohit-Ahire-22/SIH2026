import mongoose from 'mongoose'
import NutritionScan from '../models/NutritionScan.js'
import {
  extractNutritionFromImage,
  compareNutrients,
} from '../services/nutritionExtractionService.js'
import { buildRecommendations } from '../services/nutritionRecommendationService.js'
import {
  uploadProductImageToCloudinary,
  isCloudinaryConfigured,
} from '../services/imageUploadService.js'
import multer from 'multer'

// ─── Upload middleware (separate from compliance product images) ───────────────
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export const nutritionUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      const err = new Error(`Unsupported file type. Only JPEG, PNG and WEBP are allowed.`)
      err.status = 400
      cb(err)
    }
  },
  limits: { fileSize: MAX_SIZE, files: 1 },
})

export function handleNutritionUploadError(err, res) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res
      .status(400)
      .json({ success: false, message: 'Image exceeds maximum allowed size (5 MB).' })
  }
  return res.status(err.status || 400).json({ success: false, message: err.message })
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/nutrition/scan
 * Upload a nutrition label image, extract nutrients, save result.
 */
export async function uploadAndScan(req, res, next) {
  try {
    const userId = req.user.userId
    const label = req.body.label ? req.body.label.trim().substring(0, 200) : undefined
    const file = req.file

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded. Use multipart/form-data with field "nutrition_image".',
      })
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Image storage is not configured.',
        code: 'CLOUDINARY_NOT_CONFIGURED',
      })
    }

    // Upload image to Cloudinary
    const upload = await uploadProductImageToCloudinary(file.buffer, file.originalname)

    // Extract nutrition data — separate from compliance pipeline
    const extraction = await extractNutritionFromImage(upload.url)

    const scan = await NutritionScan.create({
      userId,
      label,
      imageUrl: upload.url,
      imagePublicId: upload.publicId,
      rawText: extraction.rawText,
      nutrients: extraction.nutrients,
      extractionStatus: extraction.extractionStatus,
    })

    return res.status(201).json({
      success: true,
      message: 'Nutrition label scanned',
      data: scan,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/nutrition/scans
 * List own nutrition scans.
 */
export async function listScans(req, res, next) {
  try {
    const userId = req.user.userId
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const [scans, total] = await Promise.all([
      NutritionScan.find({ userId })
        .select('-rawText') // Exclude large text from list
        .sort({ scannedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NutritionScan.countDocuments({ userId }),
    ])

    return res.status(200).json({
      success: true,
      data: scans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/nutrition/scans/:id
 * Get a single scan (IDOR-safe).
 */
export async function getScan(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user.userId

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid scan id' })
    }

    const scan = await NutritionScan.findOne({ _id: id, userId }).lean()
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found' })
    }

    return res.status(200).json({ success: true, data: scan })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /api/nutrition/scans/:id/recommend
 * Generates Open Food Facts–based product recommendations for an owned scan.
 * Recommendations are persisted with the scan so they can be re-read later.
 */
export async function generateRecommendations(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user.userId

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid scan id' })
    }

    const scan = await NutritionScan.findOne({ _id: id, userId })
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found' })
    }

    const result = await buildRecommendations(
      scan.nutrients,
      scan.label || '',
      scan.rawText || '',
    )

    scan.category = result.category.key
    scan.categoryConfidence = result.category.confidence
    scan.lowCategoryConfidence = Boolean(result.lowCategoryConfidence)
    scan.recommendationStatus = result.status
    scan.recommendations = result.recommendations || []
    scan.recommendationGeneratedAt = new Date()
    await scan.save()

    return res.status(200).json({
      success: true,
      data: {
        scanId: scan._id,
        category: result.category,
        status: result.status,
        recommendations: result.recommendations || [],
        scannedIsCompetitive: Boolean(result.scannedIsCompetitive),
        noComparableData: Boolean(result.noComparableData),
        lowCategoryConfidence: Boolean(result.lowCategoryConfidence),
        disclaimer: result.disclaimer,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/nutrition/scans/:id/recommendations
 * Reads previously generated recommendations for an owned scan.
 */
export async function getScanRecommendations(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user.userId

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid scan id' })
    }

    const scan = await NutritionScan.findOne({ _id: id, userId })
      .select('category categoryConfidence lowCategoryConfidence recommendationStatus recommendations recommendationGeneratedAt')
      .lean()
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found' })
    }

    return res.status(200).json({
      success: true,
      data: {
        scanId: scan._id,
        category: scan.category ? { key: scan.category } : null,
        status: scan.recommendationStatus,
        recommendations: scan.recommendations || [],
        lowCategoryConfidence: Boolean(scan.lowCategoryConfidence),
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/nutrition/compare?a=scanIdA&b=scanIdB
 * Compare two nutrition scans side-by-side.
 * Both scans must belong to the authenticated user.
 * Uses neutral comparison language — no health/medical claims.
 */
export async function compareScans(req, res, next) {
  try {
    const { a, b } = req.query
    const userId = req.user.userId

    if (!a || !b) {
      return res.status(400).json({
        success: false,
        message: 'Query parameters "a" and "b" (scan IDs) are required',
      })
    }

    if (a === b) {
      return res.status(400).json({
        success: false,
        message: 'Please select two different scans to compare',
      })
    }

    if (!mongoose.Types.ObjectId.isValid(a) || !mongoose.Types.ObjectId.isValid(b)) {
      return res.status(400).json({ success: false, message: 'Invalid scan id(s)' })
    }

    const [scanA, scanB] = await Promise.all([
      NutritionScan.findOne({ _id: a, userId }).lean(),
      NutritionScan.findOne({ _id: b, userId }).lean(),
    ])

    if (!scanA) {
      return res.status(404).json({ success: false, message: 'Scan A not found' })
    }
    if (!scanB) {
      return res.status(404).json({ success: false, message: 'Scan B not found' })
    }

    const comparison = compareNutrients(scanA.nutrients, scanB.nutrients)

    return res.status(200).json({
      success: true,
      data: {
        productA: { id: scanA._id, label: scanA.label || 'Product A', imageUrl: scanA.imageUrl },
        productB: { id: scanB._id, label: scanB.label || 'Product B', imageUrl: scanB.imageUrl },
        comparison,
        disclaimer:
          'This is a nutrition-based data comparison only. It does not constitute medical or dietary advice.',
      },
    })
  } catch (err) {
    return next(err)
  }
}
