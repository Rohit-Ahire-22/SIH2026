import mongoose from 'mongoose'

const { Schema } = mongoose

const nutrientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: Number }, // null/undefined = not detected
    unit: { type: String, trim: true },
    confidence: { type: Number, min: 0, max: 1 },
  },
  { _id: false },
)

const nutritionScanSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User',
    },
    label: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    imagePublicId: {
      type: String,
      trim: true,
    },
    rawText: {
      type: String,
      trim: true,
    },
    nutrients: {
      type: [nutrientSchema],
      default: [],
    },
    extractionStatus: {
      type: String,
      enum: ['EXTRACTED', 'PARTIAL', 'FAILED'],
      default: 'EXTRACTED',
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
  },
)

nutritionScanSchema.index({ userId: 1, scannedAt: -1 })

const NutritionScan =
  mongoose.models.NutritionScan || mongoose.model('NutritionScan', nutritionScanSchema)

export default NutritionScan
