import crypto from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TrainingJobService {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Queue an asynchronous training job.
   * @param {string} datasetVersion 
   * @param {string} baseModelVersion 
   */
  queueJob(datasetVersion, baseModelVersion) {
    const jobId = crypto.randomUUID();
    const job = {
      jobId,
      datasetVersion,
      baseModelVersion,
      requestedAt: new Date(),
      startedAt: null,
      completedAt: null,
      status: 'QUEUED',
      metrics: null,
      error: null,
      reasonCodes: []
    };
    
    this.jobs.set(jobId, job);
    
    // Hand off to the Python worker as a separate process
    this._spawnPythonWorker(jobId);

    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  _spawnPythonWorker(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'RUNNING';
    job.startedAt = new Date();

    const scriptPath = path.resolve(__dirname, '../../../ai-service/training/worker/train_worker.py');
    
    const args = [
      scriptPath,
      '--job-id', jobId,
      '--dataset-version', job.datasetVersion
    ];

    import('child_process').then(({ execFile }) => {
      execFile('python', args, { cwd: path.resolve(__dirname, '../../../ai-service/training/worker') }, (error, stdout, stderr) => {
        console.log('--- EXECFILE CALLBACK ---');
        console.log('Error:', error);
        console.log('Stdout:', stdout);
        console.log('Stderr:', stderr);
        job.completedAt = new Date();
        
        const outputData = stdout || '';
        
        try {
          const jsonMatch = outputData.match(/\{.*\}/s);
          if (jsonMatch) {
            const payload = JSON.parse(jsonMatch[0]);
            job.status = payload.status;
            job.reasonCodes = payload.reasonCodes || [];
            job.artifactPath = payload.artifactPath || null;
            job.artifactChecksum = payload.artifactChecksum || null;
            if (payload.metrics) {
              job.metrics = payload.metrics;
            }
            if (payload.trainingMetadata) {
              job.trainingConfig = payload.trainingMetadata;
            }
            if (payload.status === 'BLOCKED_NOT_READY' || payload.status === 'TRAINING_FAILED' || payload.status === 'ARTIFACT_INVALID') {
              job.error = payload.error || 'Readiness validation or training failed';
            }
          } else {
            if (error) {
              job.status = 'FAILED';
              job.error = stderr || 'Python worker crashed without JSON output';
            } else {
              job.status = 'COMPLETED';
            }
          }
        } catch (err) {
          job.status = 'FAILED';
          job.error = 'Failed to parse worker output';
        }
      });
    }).catch(err => {
      job.completedAt = new Date();
      job.status = 'FAILED';
      job.error = 'Failed to load child_process';
    });
  }
}
