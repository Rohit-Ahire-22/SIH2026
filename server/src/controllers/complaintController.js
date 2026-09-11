import mongoose from 'mongoose'
import Complaint, { COMPLAINT_STATUS, COMPLAINT_PRIORITY } from '../models/Complaint.js'
import Product from '../models/Product.js'
import { uploadProductImageToCloudinary, isCloudinaryConfigured } from '../services/imageUploadService.js'

// ─── Valid reasons list ────────────────────────────────────────────────────────
const VALID_REASONS = [
  'Missing mandatory declaration',
  'Incorrect MRP declaration',
  'Expired product on sale',
  'Incorrect net quantity',
  'Missing manufacturer information',
  'Missing country of origin',
  'Missing batch/lot number',
  'Missing date of manufacture/expiry',
  'Non-compliant labelling',
  'Misleading consumer information',
  'Other compliance concern',
]

// ─── Status transition rules ───────────────────────────────────────────────────
// INSPECTOR role: no direct transitions (complaints are submitted, not manipulated)
// ADMIN role: full transition authority
const ADMIN_ALLOWED_TRANSITIONS = {
  [COMPLAINT_STATUS.SUBMITTED]: [COMPLAINT_STATUS.UNDER_REVIEW, COMPLAINT_STATUS.REJECTED],
  [COMPLAINT_STATUS.UNDER_REVIEW]: [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED],
  [COMPLAINT_STATUS.RESOLVED]: [],
  [COMPLAINT_STATUS.REJECTED]: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds an inspection snapshot from a Product document.
 * Reads only persisted data — does NOT recalculate compliance.
 */
function buildInspectionSnapshot(product) {
  const latestImage =
    product.images && product.images.length > 0
      ? product.images[product.images.length - 1]
      : null

  return {
    productName: product.productName,
    brandName: product.brandName,
    manufacturerName: product.manufacturerName,
    category: product.category,
    mrp: product.mrp,
    netQuantity: product.netQuantity,
    batchLotNumber: product.batchLotNumber,
    complianceStatus: product.complianceStatus,
    analysisStatus: product.analysisStatus,
    complianceDetails: product.complianceDetails,
    imageUrl: latestImage ? latestImage.url : null,
    analysisDate: product.updatedAt,
    extractedFields: product.metadata?.extractedFields ?? null,
  }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/complaints
 * Create a new complaint referencing an existing product inspection.
 * Product ownership is verified before snapshot is taken.
 * Compliance data is read from DB — never trusted from client.
 */
export async function createComplaint(req, res, next) {
  try {
    const { productId, reason, description, additionalInfo, priority } = req.body
    const userId = req.user.userId

    // Validate required fields
    if (!productId || !reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'productId, reason, and description are required',
      })
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid productId',
      })
    }

    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reason. Must be one of the predefined complaint reasons.',
        validReasons: VALID_REASONS,
      })
    }

    if (description.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Description must be at least 20 characters.',
      })
    }

    // Verify product exists and belongs to authenticated user — IDOR prevention
    const product = await Product.findOne({ _id: productId, userId })
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or access denied',
      })
    }

    // Validate priority if supplied
    const resolvedPriority =
      priority && COMPLAINT_PRIORITY[priority] ? priority : COMPLAINT_PRIORITY.MEDIUM

    // Build snapshot from persisted DB data — never from client
    const snapshot = buildInspectionSnapshot(product)

    const complaint = new Complaint({
      userId,
      productId,
      reason,
      description: description.trim(),
      additionalInfo: additionalInfo ? additionalInfo.trim() : undefined,
      priority: resolvedPriority,
      inspectionSnapshot: snapshot,
      statusHistory: [
        {
          status: COMPLAINT_STATUS.SUBMITTED,
          changedAt: new Date(),
          changedBy: new mongoose.Types.ObjectId(userId),
          note: 'Complaint submitted by user',
        },
      ],
    })

    await complaint.save()

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted for review',
      data: {
        complaintNumber: complaint.complaintNumber,
        id: complaint._id,
        status: complaint.status,
        priority: complaint.priority,
        submittedAt: complaint.submittedAt,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/complaints
 * List complaints belonging to the authenticated user.
 */
export async function listComplaints(req, res, next) {
  try {
    const userId = req.user.userId
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const query = { userId }

    if (req.query.status && COMPLAINT_STATUS[req.query.status]) {
      query.status = req.query.status
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .select('-inspectionSnapshot.complianceDetails -inspectionSnapshot.extractedFields -statusHistory -attachments')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Complaint.countDocuments(query),
    ])

    return res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/complaints/:id
 * Get a single complaint by MongoDB ID — IDOR-safe (userId scoped).
 */
export async function getComplaint(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user.userId

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint id' })
    }

    const complaint = await Complaint.findOne({ _id: id, userId }).lean()

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      })
    }

    return res.status(200).json({ success: true, data: complaint })
  } catch (err) {
    return next(err)
  }
}

/**
 * PATCH /api/complaints/:id/status
 * Update complaint status.
 * - ADMIN can transition through the full state machine.
 * - INSPECTOR cannot change status (complaints are immutable after submission).
 */
export async function updateComplaintStatus(req, res, next) {
  try {
    const { id } = req.params
    const { status, note } = req.body
    const { userId, role } = req.user

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint id' })
    }

    if (!status || !COMPLAINT_STATUS[status]) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required',
        validStatuses: Object.values(COMPLAINT_STATUS),
      })
    }

    // Only ADMIN can change status
    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: only administrators can update complaint status',
      })
    }

    // Find by ID — admin can access any complaint
    const complaint = await Complaint.findById(id)
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' })
    }

    const allowed = ADMIN_ALLOWED_TRANSITIONS[complaint.status] || []
    if (!allowed.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot transition from ${complaint.status} to ${status}`,
        allowedTransitions: allowed,
      })
    }

    complaint.status = status
    if (status === COMPLAINT_STATUS.RESOLVED || status === COMPLAINT_STATUS.REJECTED) {
      complaint.resolvedAt = new Date()
    }
    if (req.body.authorityRemarks) {
      complaint.authorityRemarks = req.body.authorityRemarks.trim().substring(0, 2000)
    }

    complaint.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: new mongoose.Types.ObjectId(userId),
      note: note ? note.trim().substring(0, 500) : undefined,
    })

    await complaint.save()

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to ${status}`,
      data: {
        complaintNumber: complaint.complaintNumber,
        status: complaint.status,
        updatedAt: complaint.updatedAt,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /api/complaints/:id/attachments
 * Upload an attachment to an existing complaint.
 * Reuses existing Cloudinary upload infrastructure.
 * Only the complaint owner can attach files.
 */
export async function uploadComplaintAttachment(req, res, next) {
  try {
    const { id } = req.params
    const userId = req.user.userId

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint id' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Use multipart/form-data with field "attachment".',
      })
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'File storage is not available. Please contact support.',
        code: 'CLOUDINARY_NOT_CONFIGURED',
      })
    }

    // Ownership check — only owner can attach
    const complaint = await Complaint.findOne({ _id: id, userId })
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found or access denied' })
    }

    // Resolved/Rejected complaints cannot receive new attachments
    if (
      complaint.status === COMPLAINT_STATUS.RESOLVED ||
      complaint.status === COMPLAINT_STATUS.REJECTED
    ) {
      return res.status(409).json({
        success: false,
        message: 'Cannot attach files to a resolved or rejected complaint',
      })
    }

    const upload = await uploadProductImageToCloudinary(file.buffer, file.originalname)

    complaint.attachments.push({
      url: upload.url,
      publicId: upload.publicId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    })

    await complaint.save()

    return res.status(200).json({
      success: true,
      message: 'Attachment uploaded',
      data: complaint.attachments[complaint.attachments.length - 1],
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /api/complaints/reasons
 * Returns the list of valid complaint reasons.
 */
export async function getComplaintReasons(req, res) {
  return res.status(200).json({ success: true, data: VALID_REASONS })
}
