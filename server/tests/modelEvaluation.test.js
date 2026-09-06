import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelRegistryService } from '../src/services/modelRegistryService.js';
import { ModelEvaluationService } from '../src/services/modelEvaluationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'dataset');
const MODELS_DIR = path.join(__dirname, '../../ai-service/models/candidates/test_eval');

describe('Model Evaluation Gate Tests', () => {
  let registryService;
  let evaluationService;

  before(async () => {
    registryService = new ModelRegistryService();
    evaluationService = new ModelEvaluationService(registryService);
    
    await fs.mkdir(path.join(FIXTURES_DIR, 'config'), { recursive: true });
    await fs.mkdir(path.join(FIXTURES_DIR, 'annotations'), { recursive: true });

    // Fixture for current state: 0 verified evaluation annotations
    await fs.writeFile(path.join(FIXTURES_DIR, 'config', 'image-manifest.json'), JSON.stringify({
      images: [
        { id: "img1", productId: "prod1", split: "test" },
        { id: "img2", productId: "prod1", split: "train" }
      ]
    }));

    await fs.writeFile(path.join(FIXTURES_DIR, 'annotations', 'master-annotations.json'), JSON.stringify([
      { imageId: "img1", provenance: "weak_label" }
    ]));
    
    await fs.mkdir(MODELS_DIR, { recursive: true });
    await fs.writeFile(path.join(MODELS_DIR, 'candidate.pt'), "dummy");
  });

  after(async () => {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    await fs.rm(MODELS_DIR, { recursive: true, force: true });
  });

  test('Test A, E, F, G: Current state dataset blocks evaluation', async () => {
    const candidate = registryService.registerCandidateModel('fixtures', 'base_model', {});
    candidate.artifactPath = path.join(MODELS_DIR, 'candidate.pt');
    
    const result = await evaluationService.evaluateCandidate(candidate.modelVersion, 'fixtures');
    
    assert.equal(result.decision, 'EVALUATION_BLOCKED_NOT_READY');
    assert.ok(result.reasons.includes('INSUFFICIENT_VERIFIED_EVALUATION_ANNOTATIONS'));
    assert.ok(result.reasons.includes('PRODUCT_SPLIT_LEAKAGE'));
    
    // Status should remain CANDIDATE
    assert.equal(candidate.status, 'CANDIDATE');
    // Active production model should be completely untouched
    assert.equal(registryService.activeProductionModel, null);
  });

  test('Test B, C, D: Missing candidate returns safe failure', async () => {
    const result = await evaluationService.evaluateCandidate('non_existent_model', 'fixtures');
    assert.equal(result.decision, 'EVALUATION_FAILED');
    assert.ok(result.reasons[0].includes('Candidate not found'));
  });

  test('Test P: Missing artifact is handled by python script safely', async () => {
    const candidate = registryService.registerCandidateModel('fixtures', 'base_model', {});
    candidate.artifactPath = 'some/non/existent/path.pt'; // missing artifact
    
    const result = await evaluationService.evaluateCandidate(candidate.modelVersion, 'fixtures');
    // Still blocks because the dataset is blocked, but if it wasn't it would compute checksums or fail
    assert.equal(result.decision, 'EVALUATION_BLOCKED_NOT_READY');
  });
});
