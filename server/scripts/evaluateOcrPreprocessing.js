import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runOcrOnImageBuffer, isOcrServiceConfigured } from '../src/services/ocrClientService.js';
import { extractProductFields } from '../src/services/ocrFieldExtractionService.js';
import { detectProductCategory } from '../src/services/productCategoryService.js';
import { evaluateApplicability } from '../src/legal/applicability/applicabilityService.js';
import * as Rule6ComplianceService from '../src/legal/compliance/rule6ComplianceService.js';
import * as Rule789ComplianceService from '../src/legal/compliance/rule789ComplianceService.js';
import * as Rule11ComplianceService from '../src/legal/compliance/rule11ComplianceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const METADATA_PATH = path.join(DATASET_DIR, 'raw', 'proprietary', 'manifest.json');
const REPORT_DIR = path.join(DATASET_DIR, 'reports', 'ocr-preprocessing');

const VARIANTS = [
  'original',
  'grayscale',
  'upscale',
  'contrast',
  'sharpen',
  'denoise',
  'adaptive_threshold',
  'combined'
];

const METRICS_FIELDS = [
  'mrp', 'netQuantity', 'batchLotNumber', 'dateOfManufacture',
  'dateOfPacking', 'expiryOrUseByDate', 'countryOfOrigin',
  'manufacturerName', 'consumerCareDetails'
];

async function runExperiment() {
  if (!isOcrServiceConfigured()) {
    console.error('[ERROR] AI_SERVICE_URL is not configured.');
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  let maxImages = Infinity;
  let targetProduct = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-images') maxImages = parseInt(args[++i], 10);
    if (args[i] === '--product') targetProduct = args[++i];
  }

  console.log('Starting Multi-Variant OCR Preprocessing Experiment (Step 25)...');
  
  let manifest;
  const MANIFEST_PATH = path.resolve(__dirname, '../../dataset/manifests/proprietary-dataset-manifest.json');
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Failed to load manifest at ${MANIFEST_PATH}:`, err.message);
    process.exit(1);
  }

  let imagesToProcess = [];
  for (const img of manifest.images) {
    if (targetProduct && img.productId !== targetProduct) continue;
    imagesToProcess.push(img);
  }

  imagesToProcess = imagesToProcess.slice(0, maxImages);
  console.log(`Discovered ${imagesToProcess.length} images to process.`);

  await fs.mkdir(REPORT_DIR, { recursive: true });

  const variantStats = {};
  for (const v of VARIANTS) {
    variantStats[v] = {
      variant: v,
      totalLatencyMs: 0,
      totalImages: 0,
      successImages: 0,
      failedImages: 0,
      totalDetections: 0,
      confidences: [],
      fieldCoverage: METRICS_FIELDS.reduce((acc, f) => ({ ...acc, [f]: { detected: 0, missing: 0, uncertain: 0 } }), {}),
      compliance: { PASS: 0, FAIL: 0, REVIEW: 0, PENDING: 0 },
      category: { unknown: 0 } // simplified
    };
  }

  const perImageResults = [];

  for (let idx = 0; idx < imagesToProcess.length; idx++) {
    const img = imagesToProcess[idx];
    console.log(`[${idx+1}/${imagesToProcess.length}] Processing image: ${img.relativePath}`);
    
    const absPath = path.resolve(DATASET_DIR, '..', img.relativePath);
    let buffer;
    try {
      buffer = await fs.readFile(absPath);
    } catch (e) {
      console.warn(`[WARNING] Could not read ${absPath}`);
      continue;
    }

    let ext = img.extension.replace('.', '');
    let mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    for (const variant of VARIANTS) {
      const stats = variantStats[variant];
      stats.totalImages++;
      
      const startMs = Date.now();
      let ocrRes = [];
      let status = 'success';
      
      try {
        ocrRes = await runOcrOnImageBuffer(buffer, mime, variant);
      } catch (err) {
        if (err.code === 'OCR_SERVICE_TIMEOUT') status = 'timeout';
        else status = 'ocr_failed';
      }
      
      const latencyMs = Date.now() - startMs;
      stats.totalLatencyMs += latencyMs;

      if (status !== 'success') {
        stats.failedImages++;
        for (const f of METRICS_FIELDS) stats.fieldCoverage[f].uncertain++;
        continue;
      }

      stats.successImages++;
      stats.totalDetections += ocrRes.length;
      ocrRes.forEach(r => stats.confidences.push(r.confidence));

      // Field Extraction
      const textArray = ocrRes.map(r => r.text);
      const fields = extractProductFields(textArray);
      for (const f of METRICS_FIELDS) {
        if (fields[f]) stats.fieldCoverage[f].detected++;
        else stats.fieldCoverage[f].missing++;
      }

      // Category and Compliance
      let finalStatus = 'PASS';
      const category = detectProductCategory(fields, textArray);
      stats.category[category] = (stats.category[category] || 0) + 1;

      const extractedFieldsRaw = { ...fields, textDetections: textArray };
      const applicability = evaluateApplicability(extractedFieldsRaw);

      if (!applicability.isApplicable) {
        finalStatus = 'PASS';
      } else {
        const complianceResults = [];
        const r6 = Rule6ComplianceService.evaluateRule6({ product: extractedFieldsRaw, context: { domain: category, consumerType: 'RETAIL' } });
        complianceResults.push(r6.status);
        const r789 = Rule789ComplianceService.evaluateRules789({ product: extractedFieldsRaw, context: { domain: category, consumerType: 'RETAIL' } });
        complianceResults.push(r789.status);
        const r11 = await Rule11ComplianceService.evaluateRule11(extractedFieldsRaw, { domain: category, consumerType: 'RETAIL' });
        r11.forEach(r => complianceResults.push(r.status));
        
        if (complianceResults.includes('FAIL')) finalStatus = 'FAIL';
        else if (complianceResults.includes('REVIEW')) finalStatus = 'REVIEW';
        else if (complianceResults.includes('PENDING')) finalStatus = 'PENDING';
      }
      
      stats.compliance[finalStatus]++;

      perImageResults.push({
        imageId: img.imageId,
        productId: img.productId,
        view: img.view,
        variant,
        status,
        runtimeMs: latencyMs,
        detectionCount: ocrRes.length,
        averageConfidence: ocrRes.length ? ocrRes.reduce((a,b)=>a+b.confidence,0)/ocrRes.length : 0
      });
    }
  }

  // Calculate final variant metrics
  const finalSummary = { variants: [] };
  let bestVariant = 'original';
  let bestScore = -1;

  for (const v of VARIANTS) {
    const s = variantStats[v];
    const avgLatency = s.successImages ? s.totalLatencyMs / s.successImages : 0;
    const avgConf = s.confidences.length ? s.confidences.reduce((a,b)=>a+b,0)/s.confidences.length : 0;
    
    // Simple heuristic for best variant: field coverage + conf
    const detectedFields = METRICS_FIELDS.reduce((sum, f) => sum + s.fieldCoverage[f].detected, 0);
    const score = detectedFields * 100 + avgConf * 10 - avgLatency/1000;
    if (score > bestScore) {
      bestScore = score;
      bestVariant = v;
    }

    finalSummary.variants.push({
      variant: v,
      successImages: s.successImages,
      failedImages: s.failedImages,
      totalDetections: s.totalDetections,
      avgConfidence: avgConf,
      avgLatencyMs: avgLatency,
      fieldCoverage: s.fieldCoverage,
      compliance: s.compliance
    });
  }

  finalSummary.recommendation = {
    bestVariant,
    reason: "Determined using a multi-factor score balancing extracted fields, confidence, and latency."
  };

  // Generate markdown report
  let md = `# Preprocessing Experiment (Step 25)\n\n`;
  md += `## Baseline Comparison\n\n`;
  md += `| Variant | Successful Images | OCR Detections | Avg Confidence | Field Coverage | Avg Latency |\n`;
  md += `|---|---|---|---|---|---|\n`;
  
  for (const v of finalSummary.variants) {
    const totalFields = METRICS_FIELDS.reduce((sum, f) => sum + v.fieldCoverage[f].detected, 0);
    md += `| ${v.variant} | ${v.successImages} | ${v.totalDetections} | ${v.avgConfidence.toFixed(4)} | ${totalFields} | ${Math.round(v.avgLatencyMs)} ms |\n`;
  }

  md += `\n## Recommendation\n**Best Variant:** ${finalSummary.recommendation.bestVariant}\n${finalSummary.recommendation.reason}\n`;
  md += `\n> **Note:** Step 25 provides the preprocessing benchmark that will be used before introducing YOLO ROI detection and eventual model training.\n`;

  await fs.writeFile(path.join(REPORT_DIR, 'summary.json'), JSON.stringify(finalSummary, null, 2));
  await fs.writeFile(path.join(REPORT_DIR, 'per-image-results.json'), JSON.stringify(perImageResults, null, 2));
  await fs.writeFile(path.join(REPORT_DIR, 'summary.md'), md);

  console.log(`Experiment complete. Reports saved to ${REPORT_DIR}`);
}

runExperiment().catch(console.error);
