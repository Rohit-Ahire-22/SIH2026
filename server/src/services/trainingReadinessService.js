/**
 * Training Readiness Service
 * Deterministically evaluates if the SIH dataset is physically large and robust 
 * enough to initiate PyTorch YOLO training, preventing premature pipeline execution.
 */

export class TrainingReadinessService {
  /**
   * Calculates the training readiness score and status.
   * 
   * @param {Object} datasetStats 
   * @param {number} datasetStats.uniqueProducts (Must not include augmentations)
   * @param {number} datasetStats.humanVerifiedCount (Proprietary or external verified)
   * @param {number} datasetStats.weakCandidateCount (Not counted towards ground truth!)
   * @returns {Object} { status, reasoning }
   */
  static evaluateReadiness(datasetStats) {
    const { uniqueProducts, humanVerifiedCount } = datasetStats;
    
    // Safety check: ensure these are numbers
    if (typeof uniqueProducts !== 'number' || typeof humanVerifiedCount !== 'number') {
      throw new Error("Invalid stats format.");
    }

    if (uniqueProducts < 50 || humanVerifiedCount < 100) {
      return {
        status: 'NOT_READY',
        reasoning: `Dataset contains only ${uniqueProducts} products and ${humanVerifiedCount} verified labels. Minimum required for experiment is 50/100.`
      };
    }

    if (uniqueProducts >= 100 && humanVerifiedCount >= 200) {
      return {
        status: 'READY_FOR_TRAINING',
        reasoning: `Dataset contains ${uniqueProducts} products and ${humanVerifiedCount} verified labels. Ready for full PyTorch execution.`
      };
    }

    return {
      status: 'READY_FOR_SMALL_EXPERIMENT',
      reasoning: `Dataset contains ${uniqueProducts} products and ${humanVerifiedCount} verified labels. A small, non-production fine-tuning experiment is viable.`
    };
  }
}
