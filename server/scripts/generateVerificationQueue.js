import path from 'path';
import { fileURLToPath } from 'url';
import { VerificationQueueService } from '../src/services/verificationQueueService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.resolve(__dirname, '../../dataset');
const MANIFEST_PATH = path.join(DATASET_DIR, 'config', 'image-manifest.json');
const SOURCE_REGISTRY_PATH = path.join(DATASET_DIR, 'config', 'source-registry.json');
const QUEUE_PATH = path.join(DATASET_DIR, 'config', 'verification-queue.json');

async function generateVerificationQueue() {
  console.log('Generating Verification Priority Queue...');

  const queue = await VerificationQueueService.writeQueueFile({
    queuePath: QUEUE_PATH,
    manifestPath: MANIFEST_PATH,
    sourceRegistryPath: SOURCE_REGISTRY_PATH
  });

  console.log(`Queue Size: ${queue.counts.totalQueue}`);
  const breakdown = {};
  for (const item of queue.items) {
    breakdown[item.priority] = (breakdown[item.priority] || 0) + 1;
  }
  console.log(`Priority Breakdown: ${JSON.stringify(breakdown)}`);
  console.log(`Excluded: ${JSON.stringify(queue.excluded)}`);
  console.log(`Written to ${QUEUE_PATH}`);
}

generateVerificationQueue().catch(console.error);