# Proprietary Dataset Real AI/OCR Baseline Report (v2)
  
Generated At: 2026-09-05T19:12:49.928Z

**Step 24 establishes the real AI baseline that future preprocessing, YOLO, OCR improvements, and model training can be compared against.**

## Performance
- Total Baseline Runtime: 2235.88 s
- Average OCR Latency: 111790 ms/image

## Dataset
- Products Processed: 10
- Images Processed: 20 (Front: 10, Back: 10)

## OCR Statistics
- Images Successfully OCR'd: 18
- Images Failed/Timeout: 2 (0 timeouts)
- Total Text Detections: 614
- Overall Average Confidence: 0.8792
- Median Confidence: 0.9679
- Min/Max Confidence: 0.1891 / 1.0000

### View Breakdown
- Front: 76 detections (avg conf: 0.9472)
- Back: 538 detections (avg conf: 0.8696)

## Extraction Summary (Machine-extracted field coverage)
| Field | Detected | Missing | Uncertain (OCR Fail) |
|---|---|---|---|
| mrp | 0 | 8 | 2 |
| netQuantity | 1 | 7 | 2 |
| batchLotNumber | 2 | 7 | 1 |
| dateOfManufacture | 0 | 8 | 2 |
| dateOfPacking | 0 | 8 | 2 |
| expiryOrUseByDate | 0 | 8 | 2 |
| countryOfOrigin | 1 | 8 | 1 |
| manufacturerName | 2 | 6 | 2 |
| consumerCareDetails | 0 | 8 | 2 |

## Category Summary
- unknown: 10

## Compliance Summary
- PASS: 0
- FAIL: 1
- REVIEW: 9
- PENDING: 0

## Conclusion
Based on this real baseline evaluation, the pretrained PaddleOCR model successfully processes images (when the service is online) but may struggle to detect low-contrast or extremely small Indian legal metrology text on complex packaging. Because OCR detection failures gracefully degrade to `REVIEW` / `FAIL`, the compliance engine safely handles the missing data. Moving forward, custom fine-tuning and a YOLO package detector will be required to significantly improve the machine-extracted field coverage.
