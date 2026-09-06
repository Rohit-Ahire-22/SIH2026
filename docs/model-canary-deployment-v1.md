# Safe Canary / Shadow Deployment & Promotion (v1)

## Overview
The SIH26034 Model Deployment pipeline handles the final critical transition from an `EVALUATION_PASSED` Candidate model to an active Production Champion. This is achieved safely through automated stages, reducing blast radius and preventing regressions using real-world traffic signals.

## Deployment Lifecycle
```text
Candidate (EVALUATION_PASSED)
↓
Shadow (0% user-facing traffic, duplicates real predictions for async comparison)
↓
Canary (1%, 5%, 25%, 50% user-facing traffic)
↓
Promoting (100% traffic, atomic registry finalization)
↓
Production (Official Champion)
```

## Deterministic Routing
When a Canary deployment is active, `ModelResolverService` uses **Deterministic Routing**. By hashing the `correlationId` (or `userId`), a user consistently receives the same model throughout a given session, preventing jarring UX behavior across sequential page loads.

## Safety Gates & Rollback
Configured in `deployment_config.yaml`:
- **Minimum Samples:** E.g., `100`. A deployment cannot advance stages unless statistical confidence is met.
- **Rollback Thresholds:** E.g., `max_error_rate: 0.05`. If the canary encounters excessive inference crashes, the system instantly triggers an automatic `ROLLED_BACK` state.
- **Immediate Recovery:** A rollback instantly cuts Canary traffic to 0%, defaulting back to the immutable Champion.

## Atomic Promotion
A successful canary culminates in an Atomic Promotion.
- The `activeProductionModel` alias updates instantly.
- The old champion transitions to `SUPERSEDED`, remaining cached for instant rollback capability.
- An immutable `ModelDeployment` document logs the complete audit trail.

## Current State Limitations
- **Current Products**: 20
- **Total Images**: 40
- **Real Candidate Evaluated**: NONE
Because no valid candidate exists yet, the registry enforces strict immutability of the baseline fallback. The legal compliance engine remains entirely unaffected and isolated.
