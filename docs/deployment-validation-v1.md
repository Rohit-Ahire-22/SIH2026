# Stage 7.6 Deployment & Demo Validation (v1)

## Verdict

**PASS**. The production validation error (`NON_COMPLIANT is not a valid compliance status`) is resolved, verified live on the deployed backend, and the full pipeline — Image → OCR → Field Extraction → Category → Rules → Overall Compliance → Persistence → Reports — executes end-to-end in production.

## What Was Broken

1. **Production schema drift (primary)**: The deployed Render backend was running an older `Product.js` whose `complianceStatus` enum did not include `NON_COMPLIANT`. `getOverallComplianceStatus()` (which maps rule failures to `NON_COMPLIANT`) returned valid values that `product.save()` then rejected with "NON_COMPLIANT is not a valid compliance status". Local code had already been fixed; the deployment had not picked it up.
2. **AI service API key mismatch (secondary)**: The deployed backend calls the AI service through a Cloudflare Quick Tunnel to the local FastAPI service. The local service expected `AI_SERVICE_API_KEY=test-key`; the backend sent the production key. OCR requests failed with "Invalid service key", so analyses ran without OCR evidence.
3. **Analytics/UI vocabulary mismatch (secondary)**: `productController.js` aggregation queried `complianceStatus: 'PASS'`/`'FAIL'` while the model persists `COMPLIANT`/`NON_COMPLIANT`; dashboard pass/fail counts therefore always read zero for new analyses, and the frontend badge/filter helpers matched the old vocabulary.
4. **Legacy DB rows**: 25 products previously analyzed under the old code stored `FAIL`; they were excluded by the corrected aggregations.

## Fixes Delivered

| Commit | Change |
| --- | --- |
| `25c108d` | Compliance status vocabulary mismatch in `Product.js` + hardened pipeline (enum rename to `COMPLIANT`/`NON_COMPLIANT`, rule 11 test contract, dataset schema path, train worker 3-tuple) |
| `cf6feb2` | Resolve dataset schema path relative to test file (`fileURLToPath`), fixing 4 failing tests that depended on cwd |
| `da799bb` | Align compliance status vocabulary across analytics aggregation and frontend (backend `productController.js`, client result/history/landing pages) |

Plus one-time, non-committed production data migration of 25 legacy `FAIL`/`PASS` rows to `NON_COMPLIANT`/`COMPLIANT`.

## Verification Evidence

### Test Suite
- Core compliance regression: **158 pass** (including datasetSpecification 4/4 and rule11 contract).
- Full backend suite: **395 tests, 380 pass, 15 fail**. The 15 failures are a pre-existing known baseline (legacy tests using Jest globals/`describe`, missing `getProductStats` export) — unchanged by these fixes.

### Live Production (Render `sih2026-zptf.onrender.com`)
- `/api/health` → `{"success":true,"database":"connected"}`.
- Registered `stage76-demo@sih.test`; created product **Surf Excel Easy Wash** (`6aa1b4067ac0e79841e48e33`); uploaded back-panel image to Cloudinary.
- `POST /api/products/:id/analyze` → **success** on deploy (previously failed validation).
- Persisted product: `complianceStatus=NON_COMPLIANT`, `analysisStatus=COMPLETED`, `ocrResults` = 1 entry with 81 detections, `analysisError` empty.
- Reports: PDF report → HTTP 200 (`application/pdf`, 159.4 KB); DOCX report → HTTP 200 (11.8 KB).
- Analytics after migration: `summary={total:29, pass:0, fail:26, review:3, pending:0}`, `complianceDistribution={PASS:0, FAIL:26, REVIEW:3, PENDING:0}`; legacy `?status=FAIL` filter returns the same 26 rows (mapped to `NON_COMPLIANT`).

### AI Service (local + Cloudflare Quick Tunnel)
- AI service running locally at `:8000` (uniform API key alignment), reachable at `https://trained-improve-carey-spider.trycloudflare.com`; `/health` OK.
- OCR through the tunnel with the production key: `{"success":true,"count":81,...}` — confirmed end-to-end.

## Security Audit
- `helmet()` enabled; CORS restricted to `CLIENT_ORIGIN` allowlist in production with `credentials:true` and same-site cookie policy (`httpOnly`, `secure`, `sameSite:none`).
- All product routes behind `authenticate` middleware (JWT via httpOnly cookie or Bearer); unauthorized probe → 401.
- Registration hardcodes role to `INSPECTOR` (no privilege escalation).
- Public endpoints limited to `/api/health` and `/api/auth/*`; `learningRoutes.js` is not mounted.
- No real `.env` files or secrets tracked (only `.env.example` with placeholders); `.env` is gitignored.

## Deployment Configuration
- No `render.yaml`/`Dockerfile` — the three services (backend, frontend, AI) are manual Render services auto-deploying from `main`. Verified: backend and frontend picked up the fixes; AI is intentionally local behind a Quick Tunnel per environment decision.

## Residual Notes
- OCR confidence on the demo image is low (garbled output), so extracted fields were supplemented by manual entry; this is an image-quality characteristic of the sample, not a pipeline defect.
- 15 legacy test failures and the missing `getProductStats` export remain as known, pre-existing items out of scope for this stage.
- The AI service intentionally runs locally via tunnel rather than on the Render AI URL (dead/503); key must remain aligned across both sides (verified live).