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
const MODELS_DIR = path.join(__dirname, '../../ai-service/models/candidates/test_success');
const SCRIPT_PATH = path.resolve(__dirname, '../../ai-service/training/worker/train_worker.py');

describe('Training Artifact Pipeline Tests', () => {
  let jobService;

  before(async () => {
    jobService = new TrainingJobService();
    await fs.mkdir(path.join(FIXTURES_DIR, 'config'), { recursive: true });
    await fs.mkdir(path.join(FIXTURES_DIR, 'annotations'), { recursive: true });

    await fs.writeFile(path.join(FIXTURES_DIR, 'config', 'image-manifest.json'), JSON.stringify({
      productSplits: { "prod1": "train" },
      images: [
        { productId: "prod1", split: "train", sourceLicense: "APPROVED", consentStatus: "GRANTED" },
        { productId: "prod1", split: "validation", sourceLicense: "APPROVED", consentStatus: "GRANTED" }
      ]
    }));

    await fs.writeFile(path.join(FIXTURES_DIR, 'annotations', 'master-annotations.json'), JSON.stringify([
      {
        provenance: 'human_verified',
        verificationStatus: 'ACCEPTED',
        boundingBox: { x: 1.5, y: -0.1, w: 0, h: 0 }
      }
    ]));
    
    // Create a dummy fake artifact for dry-run success to test checksumming
    await fs.mkdir(path.join(MODELS_DIR, 'weights'), { recursive: true });
    await fs.writeFile(path.join(MODELS_DIR, 'weights', 'best.pt'), "dummy_weights_content");
  });

  after(async () => {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    await fs.rm(MODELS_DIR, { recursive: true, force: true });
  });

  test('Test B, C, D, E, F: Fails closed on insufficient products, leakage, and invalid annotations', async () => {
    try {
      await execFileAsync('python', [SCRIPT_PATH, '--job-id', 'test1', '--dataset-version', 'fixtures']);
      assert.fail('Should have exited with status code 1');
    } catch (err) {
      assert.equal(err.code, 1);
      const output = JSON.parse(err.stdout.match(/\{.*\}/s)[0]);
      assert.equal(output.status, 'BLOCKED_NOT_READY');
      assert.equal(output.trainingStarted, false);
      assert.ok(output.reasonCodes.includes('INSUFFICIENT_PRODUCTS'));
      assert.ok(output.reasonCodes.includes('INSUFFICIENT_VERIFIED_ANNOTATIONS'));
      assert.ok(output.reasonCodes.includes('PRODUCT_SPLIT_LEAKAGE'));
      assert.ok(output.reasonCodes.includes('INVALID_LABEL'));
    }
  });

  test('Test K, L: Node Service updates Job schema properly on BLOCKED_NOT_READY', async () => {
    return new Promise((resolve, reject) => {
      const job = jobService.queueJob('fixtures', 'base_model');
      
      const checkStatus = setInterval(() => {
        const currentJob = jobService.getJob(job.jobId);
        if (currentJob.status !== 'QUEUED' && currentJob.status !== 'RUNNING') {
          clearInterval(checkStatus);
          try {
            assert.equal(currentJob.status, 'BLOCKED_NOT_READY');
            assert.equal(currentJob.error, 'Readiness validation or training failed');
            assert.equal(currentJob.artifactPath, null);
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
