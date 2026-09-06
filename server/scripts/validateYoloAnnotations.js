import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const YOLO_MANIFEST_PATH = path.join(DATASET_DIR, 'reports', 'yolo', 'annotation-manifest.json');
const YOLO_LABELS_DIR = path.join(DATASET_DIR, 'annotations', 'yolo', 'labels');
const REPORT_DIR = path.join(DATASET_DIR, 'reports', 'yolo');
const CLASSES_CONFIG = path.resolve(__dirname, '../../ai-service/config/yolo_classes.json');

async function validateAnnotations() {
  console.log("Validating YOLO Annotations...");
  
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(YOLO_MANIFEST_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Manifest not found. Run createYoloAnnotationManifest.js first.`);
    process.exit(1);
  }

  let classConfig;
  try {
    classConfig = JSON.parse(await fs.readFile(CLASSES_CONFIG, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Failed to load classes config: ${err.message}`);
    process.exit(1);
  }

  const validClassIds = new Set(classConfig.classes.map(c => c.id));
  
  const report = {
    totalImages: manifest.images.length,
    missingLabels: 0,
    validLabels: 0,
    invalidLabels: 0,
    warnings: [],
    errors: []
  };

  for (const img of manifest.images) {
    const labelFilename = img.filename.replace(path.extname(img.filename), '.txt');
    const labelPath = path.join(YOLO_LABELS_DIR, labelFilename);
    
    let labelData;
    try {
      labelData = await fs.readFile(labelPath, 'utf-8');
    } catch (e) {
      // Label is missing, which is allowed if status is pending.
      // But if it's marked as annotated, this is an error.
      if (img.status === 'annotated' || img.status === 'validated') {
        report.errors.push(`[${img.filename}] Status is ${img.status} but label file is missing.`);
      }
      report.missingLabels++;
      continue;
    }

    const lines = labelData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let hasError = false;

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length !== 5) {
        report.errors.push(`[${img.filename}] Malformed line: expected 5 elements, got ${parts.length}`);
        hasError = true;
        continue;
      }

      const classId = parseInt(parts[0], 10);
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const w = parseFloat(parts[3]);
      const h = parseFloat(parts[4]);

      if (!validClassIds.has(classId)) {
        report.errors.push(`[${img.filename}] Invalid class ID: ${classId}`);
        hasError = true;
      }
      
      if ([x, y, w, h].some(isNaN)) {
        report.errors.push(`[${img.filename}] Non-numeric coordinate detected.`);
        hasError = true;
      }

      if (x < 0 || x > 1 || y < 0 || y > 1 || w <= 0 || w > 1 || h <= 0 || h > 1) {
        report.errors.push(`[${img.filename}] Geometry out of bounds or negative dimensions.`);
        hasError = true;
      }
      
      // Warning for suspicious boxes
      const area = w * h;
      if (area < 0.001) {
        report.warnings.push(`[${img.filename}] Extremely small box detected (area: ${area.toFixed(4)}).`);
      }
      if (area > 0.95) {
        report.warnings.push(`[${img.filename}] Extremely large box detected (area: ${area.toFixed(4)}).`);
      }
    }

    if (hasError) {
      report.invalidLabels++;
      img.status = 'rejected';
    } else {
      report.validLabels++;
      if (img.status === 'pending') {
        img.status = 'annotated'; // soft upgrade
      }
    }
  }

  // Update manifest statuses
  await fs.writeFile(YOLO_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Write reports
  await fs.writeFile(path.join(REPORT_DIR, 'validation-report.json'), JSON.stringify(report, null, 2));
  
  let md = `# YOLO Annotation Validation Report\n\n`;
  md += `- Total Images Checked: ${report.totalImages}\n`;
  md += `- Missing Labels (Pending): ${report.missingLabels}\n`;
  md += `- Valid Labels: ${report.validLabels}\n`;
  md += `- Invalid Labels: ${report.invalidLabels}\n\n`;
  
  if (report.errors.length > 0) {
    md += `## Errors\n`;
    report.errors.forEach(e => md += `- ${e}\n`);
  }
  
  if (report.warnings.length > 0) {
    md += `\n## Warnings\n`;
    report.warnings.forEach(w => md += `- ${w}\n`);
  }

  await fs.writeFile(path.join(REPORT_DIR, 'validation-report.md'), md);
  console.log(`Validation complete. Found ${report.errors.length} errors, ${report.warnings.length} warnings.`);
  console.log(`Report generated at ${REPORT_DIR}/validation-report.md`);
}

validateAnnotations().catch(console.error);
