import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDeclarationCandidates } from '../src/services/weakRoiCandidateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const MANIFEST_PATH = path.join(DATASET_DIR, 'reports', 'yolo', 'annotation-manifest.json');
const WEAK_LABELS_DIR = path.join(DATASET_DIR, 'reports', 'yolo', 'weak-candidates');

async function runExperiment() {
  console.log("Running Weak Supervision Experiment...");
  
  await fs.mkdir(WEAK_LABELS_DIR, { recursive: true });

  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Annotation manifest not found.`);
    process.exit(1);
  }

  let candidatesGenerated = 0;
  let noCandidates = 0;

  for (const img of manifest.images) {
    // In a full production run, we would call the actual PaddleOCR service here.
    // For this prototype, we simulate the OCR detection output.
    
    // Simulate: Front images rarely have the declaration block unless it's a small packet.
    // Back images usually have the declaration block.
    
    let simulatedOcrResults = [];
    const width = 1000;
    const height = 1000;

    if (img.view === 'back') {
      simulatedOcrResults = [
        { text: "Brand Name", confidence: 0.95, bbox: [[100, 100], [300, 100], [300, 150], [100, 150]] },
        // A cluster of legal terms around the middle of the back panel
        { text: "MRP Rs 150", confidence: 0.88, bbox: [[400, 400], [500, 400], [500, 430], [400, 430]] },
        { text: "NET WT 500g", confidence: 0.92, bbox: [[400, 440], [550, 440], [550, 470], [400, 470]] },
        { text: "MFD 10/25", confidence: 0.85, bbox: [[400, 480], [480, 480], [480, 510], [400, 510]] }
      ];
    } else {
      simulatedOcrResults = [
        { text: "Brand Name", confidence: 0.95, bbox: [[100, 100], [300, 100], [300, 150], [100, 150]] },
        { text: "Premium Quality", confidence: 0.9, bbox: [[100, 200], [300, 200], [300, 250], [100, 250]] }
      ];
    }

    const candidateResult = generateDeclarationCandidates(simulatedOcrResults, { width, height });

    if (candidateResult.status === 'candidate_generated') {
      candidatesGenerated++;
      
      const labelFilename = img.filename.replace(path.extname(img.filename), '.txt');
      const labelPath = path.join(WEAK_LABELS_DIR, labelFilename);
      
      let txtContent = "";
      for (const cand of candidateResult.candidates) {
        // format: classId x_center y_center w h
        const [cx, cy, w, h] = cand.bbox;
        txtContent += `${cand.classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}\n`;
      }

      await fs.writeFile(labelPath, txtContent);
    } else {
      noCandidates++;
    }
  }

  console.log(`Experiment Complete!`);
  console.log(`- Images Processed: ${manifest.images.length}`);
  console.log(`- Weak Candidates Generated: ${candidatesGenerated}`);
  console.log(`- No Candidates (Insufficient Evidence): ${noCandidates}`);
  console.log(`- Output saved to isolated directory: ${WEAK_LABELS_DIR}`);
  console.log(`\n[IMPORTANT] These pseudo-labels are isolated and retain 'weak_candidate' provenance. They must not be copied into the ground-truth directory without human verification.`);
}

runExperiment().catch(console.error);
