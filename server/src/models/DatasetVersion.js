import mongoose from 'mongoose';

const DatasetVersionSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  sampleIds: [{ type: String }],
  datasetHash: { type: String },
  trainCount: { type: Number, default: 0 },
  validationCount: { type: Number, default: 0 },
  testCount: { type: Number, default: 0 },
  source: { type: String, default: 'continuous_learning_pipeline' },
  parentDatasetVersion: { type: String },
  status: { type: String, enum: ['DRAFT', 'READY', 'USED_FOR_TRAINING', 'SUPERSEDED'], default: 'DRAFT' },
  immutabilityFlags: {
    privacyCleared: { type: Boolean, default: false },
    licenseCleared: { type: Boolean, default: false },
    noSplitLeakage: { type: Boolean, default: false }
  },
  metrics: {
    uniqueProducts: { type: Number, default: 0 },
    verifiedAnnotations: { type: Number, default: 0 }
  }
}, { timestamps: true });

export default mongoose.model('DatasetVersion', DatasetVersionSchema);
