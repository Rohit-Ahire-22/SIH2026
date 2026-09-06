# Step 32: AI Inference Performance & Reliability Fix (v1)

## Executive Summary
This report details the root cause analysis, diagnostic measurements, and resolution of the 100% Full-OCR failure rate observed during the Step 31 benchmark.

The core issue was a catastrophic deadlock caused by the FastAPI event loop running a synchronous, CPU-intensive PaddleOCR prediction directly on the main thread, resulting in completely unresponsive `/health` endpoints and immediate timeout aborts from the Node.js backend.

## Environment Details
- **OS**: Windows (Local Execution)
- **Paddle/PaddleOCR/PaddleX**: CPU-only build (`paddle.device.is_compiled_with_cuda()` == False). GPU is NOT utilized in the current environment despite hardware capability.
- **Resource Constraints**: CPU-bound inference without MKLDNN.

## Model Lifecycle & Initialization Behavior
The model was correctly architected as a lazy-initialized singleton in `get_ocr()`, preventing multiple loads. However, the first request paid the cold-start penalty.

### Direct Python Measurements
- **Memory before model init**: 136.48 MB
- **Model init time**: 4.32 s
- **Memory after model init**: 423.92 MB
- **Cold inference time**: 65.43 s
- **Memory after cold inference**: 519.24 MB
- **Warm inference 1 time**: 63.00 s
- **Warm inference 2 time**: 67.78 s

> [!WARNING]
> Because standard CPU inference takes ~65 seconds per image, the previous 60-second Node.js timeout (`OCR_SERVICE_TIMEOUT_MS=60000`) systematically aborted the request exactly 5 seconds before completion, marking it as a failure.

## Root Cause Analysis
1. **Thread Starvation / Event Loop Blocking**: The endpoint was defined as `async def ocr_image()`. In FastAPI, async routes run on the main asyncio event loop. Calling the blocking 65-second `ocr.predict()` froze the entire web server, including the `/health` endpoint.
2. **Concurrency Danger**: `PaddleOCR.predict()` is not thread-safe. Concurrent requests could theoretically corrupt memory or deadlock the underlying C++ libraries.
3. **Timeout Mismatch**: The Node backend timed out after 60s, but the OCR legitimately takes ~65s. 

## Implemented Fixes
1. **Asynchronous Delegation**: Modified `ocr.py` to use a standard synchronous `def ocr_image()`. FastAPI automatically dispatches this to a background thread pool (`starlette` threading), ensuring the main event loop remains free.
2. **Inference Locking**: Added a `threading.Lock()` (`_inference_lock`) in `ocr_service.py` specifically around `ocr.predict()`. This guarantees thread-safe sequential inference even if multiple requests arrive simultaneously, preventing memory corruption or CPU thrashing.
3. **Timeout Calibration**: Increased the Node backend timeout to 120 seconds (`ocrServiceTimeoutMs=120000`) in `env.js` to mathematically accommodate the 65s CPU inference time.

## Verification & Acceptance Test Results

- **GPU Used:** NO (CPU-only build installed)
- **Health During Inference:** RESPONSIVE. The health check now consistently returns `200 OK` in < 5ms while OCR runs in the background.
- **Real Image Test:** PASS. The API handles sequential requests cleanly.
- **2-3 Image Test:** PASS.

## Next Steps
- **STEP 33 FULL BENCHMARK:** **GO**. 
The pipeline is now stabilized and resilient to timeouts. However, due to the 65s/image latency on CPU, the upcoming 20-image benchmark will take approximately 22 minutes to execute.
