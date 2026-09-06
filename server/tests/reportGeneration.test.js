import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ReportService } from '../src/services/reportService.js';
import Product from '../src/models/Product.js';
import { ReportPdfGenerator } from '../src/services/reportPdfGenerator.js';
import { ReportDocxGenerator } from '../src/services/reportDocxGenerator.js';

describe('Report Generation Architecture', () => {

  test('Missing product ID throws error safely', async () => {
    mock.method(Product, 'findById', async () => null);
    
    try {
      await ReportService.getReportDto('fake-id');
      assert.fail('Should have thrown error');
    } catch (e) {
      assert.match(e.message, /Product not found/);
    }
    
    mock.restoreAll();
  });

  test('Incomplete analysis throws 409 style error gracefully', async () => {
    const mockProduct = {
      _id: 'fake-id',
      productName: 'No Image Product',
      analysisStatus: 'PENDING'
    };
    
    mock.method(Product, 'findById', async () => mockProduct);

    try {
      await ReportService.getReportDto('fake-id');
      assert.fail('Should have thrown error');
    } catch (e) {
      assert.match(e.message, /Analysis is not completed/);
    }
    
    mock.restoreAll();
  });

  test('Valid product yields valid Report DTO and buffers', async () => {
    const mockProduct = {
      _id: '1234567890abcdef',
      productName: 'Test Tomato Ketchup',
      analysisStatus: 'COMPLETED',
      complianceStatus: 'FAIL',
      complianceDetails: {
        evaluatedAt: new Date(),
        rule6: {
          ruleNumber: 6,
          status: 'FAIL',
          checks: [
            { requirement: 'MRP', status: 'PASS' },
            { requirement: 'Date of Packing', status: 'FAIL', clause: '6(1)(d)', reason: 'Not found' }
          ]
        }
      },
      updatedAt: new Date()
    };
    
    mock.method(Product, 'findById', async () => mockProduct);

    const dto = await ReportService.getReportDto('1234567890abcdef');
    assert.equal(dto.metadata.reportId, 'REP-12345678');
    assert.equal(dto.summary.overallStatus, 'FAIL');
    assert.equal(dto.summary.totalChecks, 2);
    assert.equal(dto.summary.checksPassed, 1);
    assert.equal(dto.summary.checksFailed, 1);
    assert.equal(dto.violations.length, 1);
    assert.equal(dto.violations[0].rule, 'Rule 6 - Clause 6(1)(d)');

    const pdfBuffer = await ReportPdfGenerator.generate(dto);
    assert.ok(pdfBuffer.length > 0);
    
    const docxBuffer = await ReportDocxGenerator.generate(dto);
    assert.ok(docxBuffer.length > 0);
    
    mock.restoreAll();
  });
});
