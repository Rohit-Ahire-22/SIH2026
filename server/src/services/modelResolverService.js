import crypto from 'crypto';

/**
 * Abstract Model Resolver Service
 * 
 * Insulates the live inference pipeline (OCR, ROI) from the model training and
 * versioning logic. Resolves the currently active production model, handling Canary routing.
 */
export class ModelResolverService {
  constructor(modelRegistryService) {
    this.registryService = modelRegistryService;
  }

  /**
   * Retrieves the current official production model version.
   * Deterministically routes a percentage of traffic to the canary model if one is active.
   * 
   * @param {object} [context] User/Request context for deterministic routing
   * @returns {string} modelVersion 
   */
  getProductionModel(context = {}) {
    const active = this.registryService.activeProductionModel;
    const fallback = active || 'v1-baseline';
    
    const deployment = this.registryService.activeDeployment;
    
    if (deployment && deployment.status.startsWith('CANARY')) {
      const routingId = context.correlationId || context.userId || crypto.randomUUID();
      
      // Hash the routingId to get a deterministic integer 0-99
      const hash = crypto.createHash('sha256').update(routingId).digest('hex');
      const hashInt = parseInt(hash.substring(0, 8), 16);
      const bucket = hashInt % 100;

      if (bucket < deployment.trafficPercentage) {
        return deployment.candidateModelVersion;
      }
    }

    return fallback;
  }
  
  /**
   * Retrieves the shadow model if one is currently deployed.
   * This is used for async background inference comparison without impacting users.
   */
  getShadowModel() {
    const deployment = this.registryService.activeDeployment;
    if (deployment && (deployment.status === 'SHADOW' || deployment.status.startsWith('CANARY'))) {
      return deployment.candidateModelVersion;
    }
    return null;
  }
}
