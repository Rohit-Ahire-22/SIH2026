import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisOrchestrationService } from '../src/services/analysisOrchestrationService.js';
import Product from '../src/models/Product.js';
import { HybridOcrService } from '../src/services/hybridOcrService.js';

describe('Analysis Orchestration Service', () => {

  test('Missing product ID throws error safely', async () => {
    mock.method(Product, 'findOne', async () => null);
    
    try {
      await AnalysisOrchestrationService.runFullAnalysis('fake-id', 'test-user');
      assert.fail('Should have thrown error');
    } catch (e) {
      assert.match(e.message, /Product not found/);
    }
    
    mock.restoreAll();
  });

  test('Missing images results in safe failure', async () => {
    const mockProduct = {
      _id: 'fake-id',
      productName: 'No Image Product',
      images: [],
      save: mock.fn(async () => {})
    };
    
    mock.method(Product, 'findOne', async () => mockProduct);

    try {
      await AnalysisOrchestrationService.runFullAnalysis('fake-id', 'test-user');
      assert.fail('Should have thrown error');
    } catch (e) {
      assert.match(e.message, /Product has no images to analyze/);
    }

    assert.equal(mockProduct.analysisStatus, 'FAILED');
    assert.equal(mockProduct.complianceStatus, 'REVIEW');
    assert.match(mockProduct.analysisError, /Product has no images to analyze/);
    
    mock.restoreAll();
  });

  test('AI Service Unavailable results in REVIEW compliance, does not corrupt document', async () => {
    const mockProduct = {
      _id: 'fake-id',
      productName: 'OCR Fail Product',
      mrp: 10,
      netQuantity: { value: 100, unit: 'g' },
      images: [{ url: 'http://example.com/fake.jpg', publicId: 'fake', mimeType: 'image/jpeg' }],
      ocrResults: [],
      save: mock.fn(async () => {}),
      toObject: () => ({ productName: 'OCR Fail Product' })
    };
    
    mock.method(Product, 'findOne', async () => mockProduct);
    
    // Mock the OCR service to throw an error (simulating FastAPI down)
    mock.method(HybridOcrService, 'runHybridOcr', async () => {
      throw new Error('ECONNREFUSED');
    });

    const result = await AnalysisOrchestrationService.runFullAnalysis('fake-id', 'test-user');
    
    assert.equal(result.analysisStatus, 'COMPLETED');
    assert.match(result.analysisError, /ECONNREFUSED/);
    assert.equal(result.complianceStatus, 'REVIEW');
    
    // Ensure save was called multiple times (processing -> completed)
    assert.equal(mockProduct.save.mock.callCount(), 2);
    
    mock.restoreAll();
  });
});
