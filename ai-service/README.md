# SIH26034 AI Service

Python + FastAPI service for the SIH26034 Packaged Commodity Compliance System.

## Setup

1. Create the virtual environment:

   ```bash
   python -m venv .venv
   ```

2. Activate it:

   - Windows (PowerShell):
     ```bash
     .venv\Scripts\Activate.ps1
     ```
   - Windows (cmd):
     ```bash
     .venv\Scripts\activate.bat
     ```
   - macOS / Linux:
     ```bash
     source .venv/bin/activate
     ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

## Health Check

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status": "ok", "service": "sih-compliance-ai-service", "message": "AI service is running"}
```

## OCR Endpoint

Extract text from product label images using PaddleOCR.

```bash
curl -X POST http://localhost:8000/ocr \
  -F "image=@path/to/label.png"
```

Accepted formats: `image/jpeg`, `image/png`, `image/webp`, `image/bmp`. Maximum size: 10 MB.

Success response:

```json
{
  "success": true,
  "count": 4,
  "results": [
    {
      "text": "MRP Rs 250.00",
      "confidence": 0.97,
      "bbox": [[36.0, 125.0], [357.0, 125.0], [357.0, 168.0], [36.0, 168.0]]
    }
  ]
}
```

`bbox` is the axis-aligned rectangle in `[x1,y1],[x2,y1],[x2,y2],[x1,y2]` order.

Common errors:

| Status | Reason |
| ------ | ------ |
| 400 | Unsupported content type, file too large, or image cannot be decoded |
| 422 | Missing `image` field |

## Notes

- OCR runs on CPU via PaddlePaddle. `enable_mkldnn=False` is set in `ocr_service.py`
  to avoid a oneDNN inference crash present in the installed PaddlePaddle version.