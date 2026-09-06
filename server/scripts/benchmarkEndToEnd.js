import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';
import os from 'os';
import express from 'express';

import { HybridOcrService } from '../src/services/hybridOcrService.js';
import { extractProductFields } from '../src/services/ocrFieldExtractionService.js';
import { detectProductCategory } from '../src/services/productCategoryService.js';
import { evaluateRule6 } from '../src/legal/compliance/rule6ComplianceService.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const REPORT_DIR = path.join(process.cwd(), '..', 'dataset', 'reports', 'e2e');
const OUTPUT_FILE = path.join(REPORT_DIR, 'e2e-benchmark-v1.json');
const MANIFEST_FILE = path.join(process.cwd(), '..', 'dataset', 'manifests', 'proprietary-dataset-manifest.json');

async function runBenchmark() {
  console.log('Starting End-to-End Production Validation Benchmark...');
  console.log(`Node version: ${process.version}`);
  console.log(`OS: ${os.type()} ${os.release()}`);
  console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);

  // Start a local server to serve images to the OCR pipeline
  const app = express();
  app.use('/dataset', express.static(path.join(process.cwd(), '..', 'dataset')));
  const server = app.listen(5001, () => console.log('Local image server running on port 5001'));

  const manifestData = JSON.parse(await fs.readFile(MANIFEST_FILE, 'utf-8'));
  const products = manifestData.products;
  const imagesList = manifestData.images;

  console.log(`Found ${products.length} proprietary products in the dataset manifest.`);

  const results = [];
  const systemMetrics = {
    startMemory: process.memoryUsage().heapUsed,
    endMemory: 0
  };

  for (const product of products) {
    console.log(`\nEvaluating Product: ${product.productId}`);
    
    const productImages = imagesList.filter(img => img.productId === product.productId);

    for (const image of productImages) {
      console.log(`  -> Processing image view: ${image.view}`);
      
      const imageUrl = `http://127.0.0.1:5001/${image.relativePath}`;
      let mimeType = 'image/jpeg';
      if (image.extension === '.png') mimeType = 'image/png';
      
      const record = {
        productId: product.productId,
        imageView: image.view,
        ocr: {
          success: false,
          fullImageDetections: 0,
          roiCandidates: 0,
          roiDetections: 0,
          fusedDetections: 0
        },
        timing: {
          fullOcrMs: 0,
          roiOcrMs: 0,
          totalMs: 0
        },
        fields: {},
        category: {},
        compliance: {},
        error: null
      };

      try {
        // 1. OCR (Hybrid Pipeline)
        const t0 = performance.now();
        const hybridResponse = await HybridOcrService.runHybridOcr(imageUrl, mimeType);
        const t1 = performance.now();
        
        record.ocr = {
          success: true,
          fullImageDetections: hybridResponse.fullImageDetections,
          roiCandidates: hybridResponse.roiCandidates,
          roiDetections: hybridResponse.roiDetections,
          fusedDetections: hybridResponse.fusedDetections
        };
        record.timing = {
          fullOcrMs: hybridResponse.runtimeMs, 
          roiOcrMs: 0, // In this version, roiOcrMs is rolled into full runtime
          totalMs: Math.round(t1 - t0)
        };

        // 2. Field Extraction
        const extracted = extractProductFields(hybridResponse.results);
        const coverage = {
          MRP: extracted.mrp ? 'DETECTED' : 'MISSING',
          'Net Quantity': extracted.netQuantity ? 'DETECTED' : 'MISSING',
          'Batch/Lot Number': extracted.batchLotNumber ? 'DETECTED' : 'MISSING',
          'Date of Manufacture': extracted.dateOfManufacture ? 'DETECTED' : 'MISSING',
          'Date of Packing': extracted.dateOfPacking ? 'DETECTED' : 'MISSING',
          'Expiry/Use By': extracted.expiryOrUseByDate ? 'DETECTED' : 'MISSING',
          'Country of Origin': extracted.countryOfOrigin ? 'DETECTED' : 'MISSING',
          'Manufacturer': extracted.manufacturerName ? 'DETECTED' : 'MISSING',
          'Consumer Care': extracted.consumerCareDetails ? 'DETECTED' : 'MISSING'
        };
        record.fields = coverage;

        // 3. Category Detection
        const categoryResult = detectProductCategory({
          productName: product.productId, // Fallback
          brandName: '',
          manufacturerName: extracted.manufacturerName,
          ocrResults: hybridResponse.results,
          extracted,
        });
        record.category = {
          category: categoryResult.category,
          categoryConfidence: categoryResult.confidence,
          categoryDetectionStatus: categoryResult.status
        };

        // 4. Deterministic Legal Metrology
        const mockProductObj = {
          productName: product.productId,
          mrp: extracted.mrp,
          netQuantity: extracted.netQuantity,
          batchLotNumber: extracted.batchLotNumber,
          dateOfManufacture: extracted.dateOfManufacture,
          dateOfPacking: extracted.dateOfPacking,
          expiryOrUseByDate: extracted.expiryOrUseByDate,
          countryOfOrigin: extracted.countryOfOrigin,
          manufacturerName: extracted.manufacturerName,
          consumerCareDetails: extracted.consumerCareDetails
        };
        
        const context = {
          packageType: 'retail',
          consumerType: 'retail',
          importStatus: 'domestic',
          domain: categoryResult.category,
          expiryRequired: ['food', 'beverage', 'pharmaceutical', 'cosmetic'].includes(categoryResult.category),
          dimensionsApplicable: false,
          unitSalePriceApplicable: false
        };

        const legalEvaluation = evaluateRule6({
          product: mockProductObj,
          context: context,
          asOfDate: new Date()
        });

        record.compliance = {
          complianceStatus: legalEvaluation.status,
          applicabilityStatus: legalEvaluation.reason,
          rulesEvaluated: legalEvaluation.checks.length,
          reviewReasons: legalEvaluation.checks
            .filter(c => c.status === 'REVIEW' || c.status === 'FAIL')
            .map(c => c.reason)
        };

      } catch (err) {
        console.error(`  [X] Failed processing image ${image.view}:`, err.message);
        record.error = err.message;
        
        if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('timeout')) {
          record.failureClassification = 'FULL_OCR_FAILURE';
        } else {
          record.failureClassification = 'OTHER';
        }
      }

      results.push(record);
    }
  }

  server.close();

  systemMetrics.endMemory = process.memoryUsage().heapUsed;
  const memoryDelta = Math.round((systemMetrics.endMemory - systemMetrics.startMemory) / 1024 / 1024);
  console.log(`\nBenchmark finished. Memory delta: ${memoryDelta} MB`);

  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Results written to ${OUTPUT_FILE}`);
}

runBenchmark().catch(err => {
  console.error(err);
  process.exit(1);
});
