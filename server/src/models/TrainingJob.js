import mongoose from 'mongoose';

const TrainingJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  baseModelVersion: { type: String, required: true },
  candidateModelVersion: { type: String, required: true },
  datasetVersion: { type: String, required: true },
  sampleCount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['QUEUED', 'VALIDATING', 'BLOCKED_NOT_READY', 'PREPARING_DATASET', 'TRAINING', 'TRAINING_FAILED', 'ARTIFACT_VALIDATION', 'CANDIDATE_READY', 'EVALUATING', 'CANARY', 'PROMOTING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'],
    default: 'QUEUED' 
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  metrics: {
    precision: { type: Number },
    recall: { type: Number },
    mAP50: { type: Number },
    mAP50_95: { type: Number }
  },
  failureReason: { type: String },
  artifactPath: { type: String },
  artifactChecksum: { type: String },
  trainingConfig: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model('TrainingJob', TrainingJobSchema);
