import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ModelEvaluationService {
  constructor(modelRegistry) {
    this.modelRegistry = modelRegistry;
  }

  async evaluateCandidate(modelVersion, evaluationDatasetVersion) {
    const candidate = this.modelRegistry.registry.get(modelVersion);
    if (!candidate) {
      return { decision: 'EVALUATION_FAILED', reasons: ['Candidate not found'] };
    }

    const championModelVersion = this.modelRegistry.activeProductionModel;
    const champion = championModelVersion ? this.modelRegistry.registry.get(championModelVersion) : null;

    const candidateArtifact = candidate.artifactPath;
    const championArtifact = champion ? champion.artifactPath : '';

    const scriptPath = path.resolve(__dirname, '../../../ai-service/training/worker/evaluate_worker.py');
    const args = [
      scriptPath,
      '--candidate-artifact', candidateArtifact,
      '--dataset-version', evaluationDatasetVersion
    ];
    
    if (championArtifact) {
      args.push('--champion-artifact', championArtifact);
    }

    return new Promise((resolve) => {
      import('child_process').then(({ execFile }) => {
        execFile('python', args, { cwd: path.resolve(__dirname, '../../../ai-service/training/worker') }, (error, stdout, stderr) => {
          let payload;
          try {
            const outputData = stdout || '';
            const jsonMatch = outputData.match(/\{.*\}/s);
            if (jsonMatch) {
              payload = JSON.parse(jsonMatch[0]);
            } else {
              resolve({ decision: 'EVALUATION_FAILED', reasons: [stderr || 'Python worker crashed without JSON output'] });
              return;
            }
          } catch (e) {
            resolve({ decision: 'EVALUATION_FAILED', reasons: ['Failed to parse worker output'] });
            return;
          }

          if (payload.decision !== 'EVALUATION_BLOCKED_NOT_READY' && payload.decision !== 'EVALUATION_FAILED') {
            try {
              this.modelRegistry.updateCandidateEvaluationStatus(modelVersion, payload);
            } catch (err) {
              payload.decision = 'EVALUATION_FAILED';
              payload.reasons.push(err.message);
            }
          }

          resolve(payload);
        });
      }).catch(err => {
        resolve({ decision: 'EVALUATION_FAILED', reasons: ['Failed to load child_process'] });
      });
    });
  }
}
