import mongoose from 'mongoose'
import Product from '../models/Product.js'
import { uploadProductImageToCloudinary } from '../services/imageUploadService.js'

export async function createProduct(req, res, next) {
  try {
    const product = await Product.create(req.body)
    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    })
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatValidationErrors(err),
      })
    }
    return next(err)
  }
}

export async function listProducts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit
    
    const query = {}
    
    // Search
    if (req.query.search) {
      // Escape regex for safety
      const escapedSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedSearch, 'i')
      query.$or = [
        { productName: regex },
        { brandName: regex },
        { manufacturerName: regex },
        { batchLotNumber: regex }
      ]
    }

    // Filters
    if (req.query.status) query.complianceStatus = req.query.status
    if (req.query.analysisStatus) query.analysisStatus = req.query.analysisStatus
    if (req.query.category) query.category = req.query.category

    // Sort
    const sortField = req.query.sort || 'createdAt'
    const sortOrder = req.query.order === 'asc' ? 1 : -1
    const sort = { [sortField]: sortOrder }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select('-ocrResults.results -ocrText') // exclude massive OCR payloads from list
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ])

    const totalPages = Math.ceil(total / limit)

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    })
  } catch (err) {
    return next(err)
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const { days } = req.query;
    let matchStage = {};

    if (days && days !== 'all') {
      const parsedDays = parseInt(days, 10);
      if (isNaN(parsedDays) || parsedDays <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid days parameter' });
      }
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parsedDays);
      matchStage = { createdAt: { $gte: cutoffDate } };
    }

    const [summaryResult, complianceDistResult, categoryBreakdownResult, trendResult] = await Promise.all([
      // 1. Summary
      Product.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pass: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'PASS'] }, 1, 0] } },
            fail: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'FAIL'] }, 1, 0] } },
            review: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'REVIEW'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'PENDING'] }, 1, 0] } },
          }
        },
        { $project: { _id: 0 } }
      ]),

      // 2. Compliance Distribution (same as above conceptually, but let's just group)
      Product.aggregate([
        { $match: matchStage },
        { $group: { _id: '$complianceStatus', count: { $sum: 1 } } }
      ]),

      // 3. Category Breakdown
      Product.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            pass: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'PASS'] }, 1, 0] } },
            fail: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'FAIL'] }, 1, 0] } },
            review: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'REVIEW'] }, 1, 0] } },
          }
        },
        { $sort: { total: -1 } }
      ]),

      // 4. Trend
      Product.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: 1 },
            pass: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'PASS'] }, 1, 0] } },
            fail: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'FAIL'] }, 1, 0] } },
            review: { $sum: { $cond: [{ $eq: ['$complianceStatus', 'REVIEW'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const summary = summaryResult[0] || { total: 0, pass: 0, fail: 0, review: 0, pending: 0 };
    
    // Normalize compliance distribution array to an object for frontend ease
    const complianceDistribution = { PASS: 0, FAIL: 0, REVIEW: 0, PENDING: 0 };
    complianceDistResult.forEach(item => {
      complianceDistribution[item._id] = item.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        summary,
        complianceDistribution,
        categoryBreakdown: categoryBreakdownResult,
        trend: trendResult
      }
    });
  } catch (err) {
    return next(err);
  }
}

export async function getProduct(req, res, next) {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid product id: ${id}`,
    })
  }

  try {
    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id: ${id}`,
      })
    }
    return res.status(200).json({
      success: true,
      data: product,
    })
  } catch (err) {
    return next(err)
  }
}

function formatValidationErrors(err) {
  const errors = {}
  for (const [field, value] of Object.entries(err.errors)) {
    errors[field] = value.message
  }
  return errors
}

export async function uploadProductImage(req, res, next) {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid product id: ${id}`,
    })
  }

  const file = req.file
  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'No image file uploaded. Use multipart/form-data with field "image".',
    })
  }

  const { isCloudinaryConfigured } = await import('../services/imageUploadService.js')

  try {
    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id: ${id}`,
      })
    }

    if (!isCloudinaryConfigured()) {
      const err = new Error(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      )
      err.status = 503
      err.code = 'CLOUDINARY_NOT_CONFIGURED'
      return res.status(503).json({
        success: false,
        message: err.message,
        code: err.code,
      })
    }

    const upload = await uploadProductImageToCloudinary(
      file.buffer,
      file.originalname,
    )

    product.images.push({
      url: upload.url,
      publicId: upload.publicId,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    })

    await product.save()

    return res.status(200).json({
      success: true,
      message: 'Product image uploaded successfully',
      data: {
        image: product.images[product.images.length - 1],
        product,
      },
    })
  } catch (err) {
    return next(err)
  }
}
