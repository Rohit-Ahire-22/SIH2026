export class DatasetVersionService {
  constructor() {
    this.versions = new Map(); // In production, this would be a MongoDB collection
  }

  /**
   * Creates a new dataset version by pulling in verified samples and ensuring
   * old representative samples are replayed to prevent catastrophic forgetting.
   * 
   * @param {string} versionName 
   * @param {Array} currentVerifiedSamples 
   * @param {Array} replayBuffer 
   */
  createDatasetVersion(versionName, currentVerifiedSamples, replayBuffer = []) {
    // 1. Strict Product-Level Isolation Check
    const trainProducts = new Set();
    const valProducts = new Set();
    const testProducts = new Set();

    const mergedSamples = [...replayBuffer, ...currentVerifiedSamples];

    // Deduplicate by sampleId
    const uniqueSamples = new Map();
    for (const sample of mergedSamples) {
      uniqueSamples.set(sample.sampleId, sample);
    }
    
    const finalSamples = Array.from(uniqueSamples.values());

    let splitLeakage = false;

    for (const sample of finalSamples) {
      // Ensure only TRAINING_ELIGIBLE samples enter
      if (sample.learning.candidateStatus !== 'TRAINING_ELIGIBLE' && sample.learning.candidateStatus !== 'USED_IN_DATASET') {
        throw new Error(`Sample ${sample.sampleId} is not training eligible.`);
      }

      // Hash-based deterministic product split (simplified for logic demo)
      const productIdHash = this._hashString(sample.productId);
      let split = 'train';
      if (productIdHash % 10 < 2) split = 'validation';
      else if (productIdHash % 10 < 3) split = 'test';

      // Verify no leakage
      if (split === 'train') {
        if (valProducts.has(sample.productId) || testProducts.has(sample.productId)) splitLeakage = true;
        trainProducts.add(sample.productId);
      } else if (split === 'validation') {
        if (trainProducts.has(sample.productId) || testProducts.has(sample.productId)) splitLeakage = true;
        valProducts.add(sample.productId);
      } else {
        if (trainProducts.has(sample.productId) || valProducts.has(sample.productId)) splitLeakage = true;
        testProducts.add(sample.productId);
      }
    }

    if (splitLeakage) {
      throw new Error('Product-level split leakage detected. Aborting dataset versioning.');
    }

    const versionMeta = {
      version: versionName,
      createdAt: new Date(),
      numberOfProducts: trainProducts.size + valProducts.size + testProducts.size,
      numberOfImages: finalSamples.length,
      trainSplit: Array.from(trainProducts),
      validationSplit: Array.from(valProducts),
      testSplit: Array.from(testProducts),
      samples: finalSamples.map(s => s.sampleId)
    };

    this.versions.set(versionName, versionMeta);

    // Update samples to USED_IN_DATASET
    for (const sample of finalSamples) {
      sample.learning.candidateStatus = 'USED_IN_DATASET';
      sample.learning.datasetVersion = versionName;
    }

    return versionMeta;
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
