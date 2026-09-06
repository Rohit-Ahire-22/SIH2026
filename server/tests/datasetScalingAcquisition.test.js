import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AcquisitionPipeline } from '../scripts/simulateAcquisitionPipeline.js';

test('Test 1: Pipeline rejects invalid licenses', () => {
  const pipeline = new AcquisitionPipeline();
  const item = { license: 'unknown', width: 500, height: 500 };
  pipeline.enqueue(item);
  pipeline.processQueue();
  assert.equal(item.state, 'REJECTED');
  assert.equal(item.rejectionReason, 'Invalid or unknown license');
});

test('Test 2: Pipeline enforces quality gates', () => {
  const pipeline = new AcquisitionPipeline();
  const item = { license: 'proprietary', width: 200, height: 200 }; // Below 300
  pipeline.enqueue(item);
  pipeline.processQueue();
  assert.equal(item.state, 'REJECTED');
  assert.equal(item.rejectionReason, 'Failed quality gate');
});

test('Test 3: Pipeline enforces duplicate SHA-256 detection', () => {
  const pipeline = new AcquisitionPipeline();
  
  const img1 = { 
    license: 'proprietary', width: 500, height: 500, 
    hash: 'abc', sourceUrl: 'http://a', acquisitionTimestamp: 123 
  };
  const img2 = { 
    license: 'proprietary', width: 500, height: 500, 
    hash: 'abc', sourceUrl: 'http://b', acquisitionTimestamp: 124 
  };

  pipeline.enqueue(img1);
  pipeline.enqueue(img2);
  pipeline.processQueue();

  assert.equal(img1.state, 'ANNOTATION_PENDING'); // Passes up to annotation pending
  assert.equal(img2.state, 'REJECTED');
  assert.equal(img2.rejectionReason, 'Duplicate SHA-256 hash');
});

test('Test 4: Product-level milestones', () => {
  const pipeline = new AcquisitionPipeline();
  assert.equal(pipeline.calculateMilestone(10, 20), 'PRE_MILESTONE');
  assert.equal(pipeline.calculateMilestone(25, 50), 'MILESTONE_A');
  assert.equal(pipeline.calculateMilestone(100, 250), 'MILESTONE_D');
});
