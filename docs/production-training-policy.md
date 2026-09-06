# Production Training Policy

## 1. No Automatic Ground Truth
Production inferences and algorithmic weak supervision are NEVER automatically treated as training ground truth. A human reviewer (admin or trusted user) must explicitly verify annotations via the Verification Queue before they become `TRAINING_ELIGIBLE`.

## 2. No Autonomous Training
The system will not continuously loop training operations in the background based on real-time traffic. Training is a batched, scheduled process triggered either manually or when specific dataset volume thresholds are crossed.

## 3. Privacy & Licensing
By default, all user images uploaded via the public API are tagged `INFERENCE_ONLY`. If a user does not explicitly grant consent, the image cannot transition to `CANDIDATE`. Furthermore, any conditionally licensed data (e.g., CC-BY-SA Open Food Facts) must not be mixed into proprietary core training sets intended for commercial distribution.

## 4. Replay and Catastrophic Forgetting
Fine-tuning models on purely novel data will cause catastrophic forgetting. Any newly generated dataset version must merge the new Verified samples with a statistically representative baseline of previous data.
