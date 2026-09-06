import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TrainingJobService } from '../src/services/trainingJobService.js';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'dataset');

describe('Training Worker Integration Tests', () => {
  let jobService;

  before(async () => {
    jobService = new TrainingJobService();
    // Create temporary invalid dataset
    await fs.mkdir(path.join(FIXTURES_DIR, 'config'), { recursive: true });
    await fs.mkdir(path.join(FIXTURES_DIR, 'annotations'), { recursive: true });

    // Base manifest with 1 product and 1 image
    await fs.writeFile(path.join(FIXTURES_DIR, 'config', 'image-manifest.json'), JSON.stringify({
      productSplits: { "prod1": "train" },
      images: [
        { productId: "prod1", split: "train", sourceLicense: "APPROVED", consentStatus: "GRANTED" },
        { productId: "prod1", split: "validation", sourceLicense: "APPROVED", consentStatus: "GRANTED" } // Intentional Leakage
      ]
    }));

    // Base annotations with invalid bounding box format
    await fs.writeFile(path.join(FIXTURES_DIR, 'annotations', 'master-annotations.json'), JSON.stringify([
      {
        provenance: 'human_verified',
        verificationStatus: 'ACCEPTED',
        boundingBox: { x: 1.5, y: -0.1, w: 0, h: 0 } // Invalid
      }
    ]));
  });

  after(async () => {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
  });

  test('Test A, C, D, E, F: Worker returns BLOCKED_NOT_READY with deterministic reasons', async () => {
    const scriptPath = path.resolve(__dirname, '../../ai-service/training/worker/train_worker.py');
    try {
      const { stdout } = await execFileAsync('python', [scriptPath, '--job-id', 'test1', '--dataset-version', 'fixtures', '--dry-run']);
      assert.fail('Should have exited with status code 1');
    } catch (err) {
      assert.equal(err.code, 1);
      const output = JSON.parse(err.stdout.match(/\{.*\}/s)[0]);
      console.log('Worker output:', output);
      assert.equal(output.status, 'BLOCKED_NOT_READY');
      assert.ok(output.reasonCodes.includes('INSUFFICIENT_PRODUCTS'));
      assert.ok(output.reasonCodes.includes('INSUFFICIENT_VERIFIED_ANNOTATIONS'));
      assert.ok(output.reasonCodes.includes('INVALID_LABEL'));
      assert.ok(output.reasonCodes.includes('PRODUCT_SPLIT_LEAKAGE'));
    }
  });

  test('Test J, K, L: Node Service handles Python integration', async () => {
    // Modify job service spawn to wait so we can assert (using a wrapper for the test)
    return new Promise((resolve, reject) => {
      const job = jobService.queueJob('fixtures', 'base_model');
      
      const checkStatus = setInterval(() => {
        const currentJob = jobService.getJob(job.jobId);
        if (currentJob.status !== 'QUEUED' && currentJob.status !== 'RUNNING') {
          clearInterval(checkStatus);
          try {
            console.log('Final job state:', currentJob);
            assert.equal(currentJob.status, 'BLOCKED_NOT_READY');
            assert.ok(currentJob.reasonCodes.includes('INSUFFICIENT_PRODUCTS'));
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      }, 100);
    });
  });
});
