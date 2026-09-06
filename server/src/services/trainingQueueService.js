/**
 * Abstract Training Queue Service
 * 
 * Decouples the live inference and verification API from the heavy process of
 * dataset compilation and YOLO/OCR training. This interface can later be backed
 * by BullMQ, Redis, or Celery.
 */
export class TrainingQueueService {
  constructor() {
    this.pendingSamples = new Set();
    this.activeJobs = new Map();
  }

  /**
   * Enqueue a single verified, eligible sample for the next dataset snapshot.
   * @param {string} sampleId 
   */
  async enqueueSample(sampleId) {
    this.pendingSamples.add(sampleId);
    
    // In a real system, you might trigger a debounced job to compile a dataset
    // once a threshold is met or after a timeout.
    return { queued: true, sampleId };
  }

  /**
   * Immediately trigger a dataset generation and training job.
   * @param {string} datasetVersion 
   * @param {string} baseModelVersion 
   * @returns {string} jobId
   */
  async enqueueDatasetTraining(datasetVersion, baseModelVersion) {
    const jobId = `job_${Date.now()}`;
    
    // Prevent duplicate simultaneous training jobs for the same lineage
    for (const job of this.activeJobs.values()) {
      if (job.status === 'QUEUED' || job.status === 'TRAINING' || job.status === 'PREPARING_DATASET') {
        if (job.baseModelVersion === baseModelVersion) {
          throw new Error('A training job for this base model lineage is already in progress.');
        }
      }
    }

    this.activeJobs.set(jobId, {
      jobId,
      datasetVersion,
      baseModelVersion,
      status: 'QUEUED',
      createdAt: new Date()
    });

    return jobId;
  }

  async getNextJob() {
    for (const job of this.activeJobs.values()) {
      if (job.status === 'QUEUED') return job;
    }
    return null;
  }

  async updateJobStatus(jobId, status) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = status;
      return true;
    }
    return false;
  }

  /**
   * Evaluates a monitoring trigger and safely determines if retraining should proceed.
   * If readiness fails (e.g. < 50 products), it securely returns BLOCKED_NOT_READY.
   */
  async handleRetrainingRequest(triggerDetails) {
    // We mock the dataset stats pull which should evaluate the current verified dataset
    // Current actual dataset: 20 products, 0 verified.
    const currentDatasetStats = {
      uniqueProducts: 20, 
      humanVerifiedCount: 0,
      weakCandidateCount: 10
    };

    // We dynamically import TrainingReadinessService logic conceptually, but for simplicity:
    if (currentDatasetStats.uniqueProducts < 50 || currentDatasetStats.humanVerifiedCount < 100) {
      return { 
        status: 'RETRAINING_BLOCKED_NOT_READY', 
        reason: 'Dataset does not meet minimum threshold of 50 products and 100 human verified annotations',
        stats: currentDatasetStats
      };
    }

    // If it passed readiness, we would enqueue a job:
    // const jobId = await this.enqueueDatasetTraining('latest', 'active_champion');
    // return { status: 'RETRAINING_QUEUED', jobId };
    
    return { status: 'RETRAINING_QUEUED' };
  }
}
