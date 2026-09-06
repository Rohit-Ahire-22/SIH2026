import mongoose from 'mongoose';

const TrainingSampleSchema = new mongoose.Schema({
  sampleId: { type: String, required: true, unique: true },
  source: { type: String, required: true },
  productId: { type: String, required: true },
  imageUrl: { type: String, required: true },
  imagePublicId: { type: String, required: true }, // Cloudinary ID or similar
  imageHash: { type: String, required: true },
  imageView: { type: String, enum: ['front', 'back', 'declaration', 'other', 'unknown'], default: 'unknown' },
  
  inference: {
    ocrModelVersion: { type: String },
    roiModelVersion: { type: String },
    extractionVersion: { type: String },
    detectedFields: { type: Map, of: String },
    detectionConfidence: { type: Number },
    category: { type: String },
    complianceStatus: { type: String, enum: ['PASS', 'FAIL', 'REVIEW', 'UNKNOWN'], default: 'UNKNOWN' }
  },

  quality: {
    blurScore: { type: Number },
    brightnessScore: { type: Number },
    resolution: { type: String }, // e.g., "1920x1080"
    imageQualityStatus: { type: String, enum: ['PASS', 'FAIL', 'PENDING'], default: 'PENDING' }
  },

  learning: {
    candidateStatus: { 
      type: String, 
      enum: ['INFERENCE_ONLY', 'CANDIDATE', 'NEEDS_REVIEW', 'VERIFIED', 'REJECTED', 'TRAINING_ELIGIBLE', 'USED_IN_DATASET', 'IN_TRAINING', 'TRAINED_IN_CANDIDATE'],
      default: 'INFERENCE_ONLY' 
    },
    learningValueScore: { type: Number, default: 0 },
    candidateReason: { type: String },
    annotationStatus: { type: String, enum: ['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
    verificationStatus: { type: String, enum: ['UNVERIFIED', 'VERIFIED', 'REJECTED'], default: 'UNVERIFIED' },
    trainingEligible: { type: Boolean, default: false },
    trainingEligibilityReason: { type: String },
    datasetVersion: { type: String },
    modelVersionsUsed: [{ type: String }]
  },

  provenance: {
    sourceType: { type: String, enum: ['proprietary', 'user_upload', 'licensed_external'], required: true },
    licenseStatus: { type: String },
    consentStatus: { type: String, enum: ['NOT_REQUIRED', 'PENDING', 'GRANTED', 'DENIED'], default: 'PENDING' }
  },

  feedback: {
    userCorrected: { type: Boolean, default: false },
    originalPrediction: { type: Map, of: String },
    correctedPrediction: { type: Map, of: String },
    correctionSource: { type: String }, // e.g. "admin_dashboard", "public_ui"
    reviewedBy: { type: String },
    reviewedAt: { type: Date }
  }
}, { timestamps: true });

export default mongoose.model('TrainingSample', TrainingSampleSchema);
