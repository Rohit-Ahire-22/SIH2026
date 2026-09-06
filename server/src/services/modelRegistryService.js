import crypto from 'crypto';

export class ModelRegistryService {
  constructor() {
    this.registry = new Map();
    this.activeProductionModel = null;
  }

  registerCandidateModel(datasetVersion, baseModelVersion, metrics) {
    const modelVersion = `model-v${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const model = {
      modelVersion,
      modelType: 'yolo_hybrid_ocr',
      datasetVersion,
      baseModel: baseModelVersion,
      createdAt: new Date(),
      metrics,
      status: 'CANDIDATE',
      artifactPath: `/models/${modelVersion}.pt`
    };
    
    this.registry.set(modelVersion, model);
    return model;
  }

  updateCandidateEvaluationStatus(modelVersion, evaluationResult) {
    const model = this.registry.get(modelVersion);
    if (!model) throw new Error('Model not found');

    if (model.status !== 'CANDIDATE') {
      throw new Error('Only CANDIDATE models can be updated with evaluation results');
    }

    if (evaluationResult.decision === 'PASS') {
      model.status = 'EVALUATION_PASSED';
    } else if (evaluationResult.decision === 'REJECT') {
      model.status = 'REJECTED';
    }
    
    model.evaluationMetrics = evaluationResult.candidateMetrics;
    model.evaluationDeltas = evaluationResult.metricDeltas;
    model.evaluationReasons = evaluationResult.reasons;
    model.evaluatedAt = new Date();

    return model;
  }

  promoteToProduction(modelVersion, deploymentId) {
    const candidate = this.registry.get(modelVersion);
    if (!candidate) throw new Error('Model not found');

    if (candidate.status !== 'SHADOW' && !candidate.status.startsWith('CANARY') && candidate.status !== 'PROMOTING') {
      throw new Error('Model must be in deployment pipeline to be promoted');
    }

    if (this.activeProductionModel) {
      const current = this.registry.get(this.activeProductionModel);
      if (current) current.status = 'SUPERSEDED'; // Keeps it safe for rollback
    }

    candidate.status = 'PRODUCTION';
    candidate.promotedAt = new Date();
    candidate.deploymentId = deploymentId;
    this.activeProductionModel = modelVersion;
    this.activeDeployment = null;

    return candidate;
  }

  rollback(previousModelVersion) {
    const previousModel = this.registry.get(previousModelVersion);
    if (!previousModel) throw new Error('Previous model not found');

    if (this.activeProductionModel) {
      const current = this.registry.get(this.activeProductionModel);
      if (current) current.status = 'ROLLED_BACK';
    }

    previousModel.status = 'PRODUCTION';
    this.activeProductionModel = previousModelVersion;
    
    return previousModel;
  }
}
