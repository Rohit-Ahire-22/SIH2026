import mongoose from 'mongoose';

const ModelDeploymentSchema = new mongoose.Schema({
  deploymentId: { type: String, required: true, unique: true },
  candidateModelVersion: { type: String, required: true },
  championModelVersion: { type: String },
  status: { 
    type: String, 
    enum: ['SHADOW', 'CANARY_1', 'CANARY_5', 'CANARY_25', 'CANARY_50', 'PROMOTING', 'PRODUCTION', 'ROLLED_BACK'],
    required: true
  },
  trafficPercentage: { type: Number, default: 0 },
  startAt: { type: Date, default: Date.now },
  endAt: { type: Date },
  metrics: {
    samplesProcessed: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    latencyP95: { type: Number, default: 0 }
  },
  rollbackReason: { type: String },
  promotionReason: { type: String },
  auditLog: [{
    action: String,
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }]
}, { timestamps: true });

export default mongoose.model('ModelDeployment', ModelDeploymentSchema);
