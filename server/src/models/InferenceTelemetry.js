import mongoose from 'mongoose';

const InferenceTelemetrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  correlationId: { type: String, index: true },
  modelVersion: { type: String, required: true, index: true },
  deploymentId: { type: String, index: true },
  
  // System Metrics
  inferenceStatus: { type: String, enum: ['SUCCESS', 'FAILURE', 'TIMEOUT'], required: true },
  latencyMs: { type: Number, required: true },
  errorCategory: { type: String },
  
  // Model Metrics
  predictionCount: { type: Number, default: 0 },
  averageConfidence: { type: Number },
  detectedClasses: [{ type: String }],
  
  // Input Drift Proxies (no raw images)
  imageWidth: { type: Number },
  imageHeight: { type: Number },
  blurScore: { type: Number }
}, { 
  timestamps: false,
  // Ensure telemetry automatically expires after 30 days to prevent unbounded growth
  expireAfterSeconds: 2592000 
});

// Create TTL index
InferenceTelemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model('InferenceTelemetry', InferenceTelemetrySchema);
