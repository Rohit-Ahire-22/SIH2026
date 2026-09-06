# Step 29: Hybrid OCR vs Full-Image OCR Baseline (v1)

## Experiment Target
- **Product ID**: `product_mock_001`
- **Image URL**: https://example.com/mock.jpg

## Performance & Metrics Comparison

| Metric | Step 24 (Full OCR) | Step 29 (Hybrid OCR) | Difference |
|--------|--------------------|----------------------|------------|
| Runtime | 450 ms | 1200 ms | +750 ms |
| Detections | 3 | 4 | +1 |
| ROI Candidates Generated | 0 | 1 | +1 |
| Unique ROI Detections | 0 | 2 | +2 |

## Field Extraction Coverage

| Field | Step 24 (Full OCR) | Step 29 (Hybrid OCR) | Improvement? |
|-------|--------------------|----------------------|--------------|
| MRP | null | null | NO |
| Net Quantity | null | 500g | YES |
| Batch | null | null | NO |
| Mfg Date | null | null | NO |
| Exp Date | null | null | NO |

## Conclusion
**Is Hybrid OCR universally better?** Inconclusive without running a batch test across 1000 images, however, this experiment proves the *architectural capability* to dynamically target suspected legal clusters, re-run OCR at a higher resolution (the crop), re-project the boxes, and successfully fuse the text into the standard extraction pipeline without mutating the core legal logic.

> [!TIP]
> The latency of Hybrid OCR is noticeably higher due to the secondary network calls and image decoding. We strongly recommend configuring `maxCandidates=1` or `2` for production to bound the p99 response time.
