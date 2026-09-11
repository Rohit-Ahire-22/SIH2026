import mongoose from 'mongoose'
import { nextSequence } from './Counter.js'

const { Schema } = mongoose

export const COMPLAINT_STATUS = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
})

const COMPLAINT_STATUS_VALUES = Object.values(COMPLAINT_STATUS)

export const COMPLAINT_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
})

const COMPLAINT_PRIORITY_VALUES = Object.values(COMPLAINT_PRIORITY)

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    originalName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: COMPLAINT_STATUS_VALUES,
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
  },
  { _id: false },
)

/**
 * A frozen snapshot of the inspection evidence at complaint-submission time.
 * Stored as Mixed so no compliance pipeline types are changed.
 * The snapshot is read-once from the persisted Product document.
 */
const inspectionSnapshotSchema = new Schema(
  {
    productName: String,
    brandName: String,
    manufacturerName: String,
    category: String,
    mrp: Number,
    netQuantity: Schema.Types.Mixed,
    batchLotNumber: String,
    complianceStatus: String,
    analysisStatus: String,
    complianceDetails: Schema.Types.Mixed,
    imageUrl: String,
    analysisDate: Date,
    extractedFields: Schema.Types.Mixed,
  },
  { _id: false },
)

const complaintSchema = new Schema(
  {
    complaintNumber: {
      type: String,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User',
    },
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'Product',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    additionalInfo: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: {
        values: COMPLAINT_STATUS_VALUES,
        message: '`{VALUE}` is not a valid complaint status',
      },
      default: COMPLAINT_STATUS.SUBMITTED,
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: COMPLAINT_PRIORITY_VALUES,
        message: '`{VALUE}` is not a valid priority',
      },
      default: COMPLAINT_PRIORITY.MEDIUM,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resolvedAt: { type: Date },
    authorityRemarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    inspectionSnapshot: {
      type: inspectionSnapshotSchema,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
  },
)

complaintSchema.index({ userId: 1, submittedAt: -1 })
complaintSchema.index({ status: 1 })
complaintSchema.index({ productId: 1 })

/**
 * Pre-save hook: generate complaintNumber before first save.
 * CMP-YYYY-NNNNNN format, e.g. CMP-2026-000001
 */
complaintSchema.pre('save', async function () {
  if (this.isNew && !this.complaintNumber) {
    const seq = await nextSequence('complaint')
    const year = new Date().getFullYear()
    this.complaintNumber = `CMP-${year}-${String(seq).padStart(6, '0')}`
  }
})

const Complaint = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema)

export default Complaint
