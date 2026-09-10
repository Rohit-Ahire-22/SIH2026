import mongoose from 'mongoose'

const { Schema } = mongoose

export const COMPLIANCE_STATUS = Object.freeze({
  COMPLIANT: 'COMPLIANT',
  NON_COMPLIANT: 'NON_COMPLIANT',
  REVIEW: 'REVIEW',
  PENDING: 'PENDING',
})

const COMPLIANCE_STATUS_VALUES = Object.values(COMPLIANCE_STATUS)

const imageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    label: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const ocrEntrySchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    confidence: { type: Number, min: 0, max: 1 },
    bbox: { type: [[Number]], default: undefined },
  },
  { _id: false },
)

const ocrResultSchema = new Schema(
  {
    imageIndex: { type: Number },
    imageUrl: { type: String, trim: true },
    publicId: { type: String, trim: true },
    results: { type: [ocrEntrySchema], default: [] },
    processedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const productSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    productName: { type: String, required: true, trim: true, index: true },
    brandName: { type: String, trim: true, index: true },
    manufacturerName: { type: String, trim: true },
    mrp: {
      type: Number,
      required: true,
      min: [0, 'MRP cannot be negative'],
      set: roundCurrency,
    },
    netQuantity: {
      value: { type: Number, required: true, min: [0, 'Net quantity cannot be negative'] },
      unit: { type: String, required: true, trim: true },
    },
    batchLotNumber: { type: String, trim: true, index: true },
    dateOfManufacture: { type: Date },
    dateOfPacking: { type: Date },
    expiryOrUseByDate: { type: Date, index: true },
    countryOfOrigin: { type: String, trim: true },
    commonGenericName: { type: String, trim: true },
    consumerCareDetails: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    legalDeclarations: { type: String, trim: true },
    images: { type: [imageSchema], default: [] },
    ocrText: { type: String, trim: true },
    ocrResults: { type: [ocrResultSchema], default: [] },

    complianceStatus: {
      type: String,
      enum: {
        values: COMPLIANCE_STATUS_VALUES,
        message: '`{VALUE}` is not a valid compliance status',
      },
      default: COMPLIANCE_STATUS.PENDING,
      index: true,
    },

    analysisStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
        message: '`{VALUE}` is not a valid analysis status',
      },
      default: 'PENDING',
      index: true
    },
    analysisError: { type: String },
    
    complianceDetails: { type: Schema.Types.Mixed, default: {} },

    category: {
      type: String,
      enum: {
        values: [
          'food',
          'beverage',
          'cosmetic',
          'personal_care',
          'household',
          'electronics',
          'pharmaceutical',
          'agricultural',
          'other',
          'unknown',
        ],
        message: '`{VALUE}` is not a valid product category',
      },
      default: 'unknown',
    },
    categoryConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    categoryMatchedKeywords: { type: [String], default: [] },
    categoryDetectionStatus: {
      type: String,
      enum: {
        values: ['DETECTED', 'REVIEW', 'UNKNOWN'],
        message: '`{VALUE}` is not a valid category detection status',
      },
      default: 'UNKNOWN',
    },

    // Reserved (empty by default) for later extension.
    // OCR extraction, rule-engine results, evidence, compliance scoring,
    // and inspection history will be added in later steps.
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: '__v',
  },
)

productSchema.index({ createdAt: -1 })
productSchema.index({ category: 1 })
productSchema.index({ manufacturerName: 1 })
productSchema.index({ userId: 1, createdAt: -1 })

function roundCurrency(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100
  }
  return value
}

const Product = mongoose.models.Product || mongoose.model('Product', productSchema)

export default Product
