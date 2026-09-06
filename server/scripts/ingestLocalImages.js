import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { LocalImageIngestionService } from '../src/services/localImageIngestionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const RAW_PROPRIETARY_DIR = path.join(DATASET_DIR, 'raw', 'proprietary');
const MANIFEST_PATH = path.join(DATASET_DIR, 'config', 'image-manifest.json');

async function ingestLocalImages() {
  console.log('Ingesting Local Images...');

  const service = new LocalImageIngestionService({
    rawRoot: RAW_PROPRIETARY_DIR,
    manifestPath: MANIFEST_PATH
  });

  const summary = await service.ingest();

  console.log(`Products Scanned: ${summary.productsScanned}`);
  console.log(`Raw Files Scanned: ${summary.rawFilesScanned}`);
  console.log(`Imported: ${summary.imported}`);
  console.log(`Enriched (already registered): ${summary.enriched}`);
  console.log(`Exact Duplicates Rejected: ${summary.exactDuplicates}`);
  console.log(`Near Duplicates Flagged: ${summary.nearDuplicates}`);
  console.log(`Review Flagged: ${summary.review}`);
  console.log(`Malformed: ${summary.malformed}`);
  console.log(`Unique Products Tracked: ${summary.uniqueProducts}`);
  console.log(`Total Images In Manifest: ${summary.totalImagesInManifest}`);

  await fs.writeFile(path.join(DATASET_DIR, 'config', 'ingestion-last-summary.json'), JSON.stringify(summary, null, 2));
}

ingestLocalImages().catch(console.error);