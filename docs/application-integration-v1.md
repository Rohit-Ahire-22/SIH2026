# Application Integration Architecture (v1)

This document describes the orchestration flow merging the frontend UI, Node backend logic, Python ML service, and the Deterministic Legal Engine into a unified, user-facing product flow.

## 1. Request Flow

1. **Frontend (React)** 
   - User navigates to `/inspections/new`.
   - Submits product metadata (optional) and an image payload.
   - Frontend invokes `POST /api/products` (creates product shell).
   - Frontend invokes `POST /api/products/:id/images` (uploads to Cloudinary).
2. **Backend (Node.js)**
   - Receives POST requests. Mongoose persists product state (`analysisStatus: 'PENDING'`).
   - Responds to frontend with Product ID.
3. **Frontend Analysis Hand-off**
   - Redirects to `/inspections/:id/analyze`.
   - Frontend invokes `POST /api/products/:id/analyze`.
4. **Analysis Orchestrator (Node.js)**
   - Marks status as `PROCESSING`.
   - **Step A:** Invokes FastAPI (`HybridOcrService`) with image URL.
   - **Step B:** Pipes OCR result into Field Extraction Service.
   - **Step C:** Detects product category based on text bounds and product name.
   - **Step D:** Combines inputs into `legalContext` and evaluates Rule 6, Rule 7/8/9, Rule 11.
   - **Step E:** Aggregates worst-case compliance status (`PASS`/`FAIL`/`REVIEW`).
   - Commits state as `COMPLETED` and returns JSON payload.
5. **Frontend Result View**
   - Redirects to `/inspections/:id/result`.
   - Parses the returned data to visualize compliance summary, verified evidence (OCR overlays), and deterministic rule breakdowns.

## 2. Safety and Persistence 
- **Graceful degradation:** If FastAPI crashes (ECONNREFUSED) or throws an exception, the Node.js backend *catches* the error. `analysisStatus` becomes `COMPLETED` (or `FAILED` if unrecoverable), `analysisError` captures the fault, and the final compliance is forced to `REVIEW`. **We never fake compliance.**
- **Legal Authority:** Legal Metrology logic evaluates based strictly on *presence* or *confirmed absence*. OCR omission is treated as "insufficient evidence" resulting in `REVIEW`.
- **Idempotency:** Re-running `/analyze` updates the existing product record instead of duplicating records in MongoDB.

## 3. Boundaries
- The React Frontend NEVER speaks directly to the Python AI service.
- The Node.js Backend is the sole authoritative state machine for legal execution.
- LLMs are entirely prohibited from making "compliance decisions". The rule evaluations are hard-coded TS/JS matrices enforcing the exact wording of the 2011 act.
