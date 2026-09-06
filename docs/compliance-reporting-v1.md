# Compliance Reporting Architecture (v1)

This document describes the generation of official-looking (but non-statutory) compliance reports in PDF and DOCX format.

## Architecture

1. **Endpoint Initiation**: User clicks "Download PDF" or "Download Editable Report" on the UI.
2. **Controller `reportController.js`**: Validates the `id` and confirms `analysisStatus === 'COMPLETED'`. Returns 409 Conflict otherwise.
3. **Report Service `reportService.js`**: Retrieves the Product document and normalizes it into a generic `ReportDTO`. 
4. **Generator**: 
   - PDF uses `ReportPdfGenerator.js` via `pdfkit`
   - DOCX uses `ReportDocxGenerator.js` via `docx`
5. **Output**: Streams buffer back directly as an attachment response.

## Data Normalization (`ReportDTO`)

To prevent logic duplication across PDF and DOCX generators, we use a single mapping function in `reportService.js` to derive:
- `totalChecks`, `checksPassed`, `checksFailed`, `checksReview`
- `violations`: Flat array of non-compliant rules.
- `reviews`: Flat array of uncertain rules requiring physical review.
- `productInfo`: Formatted string representations (handling `null` as "Not detected").
- `ocrEvidence`: Array of raw text blocks with confidence.

## Safety Measures
- **Disclaimer**: Every report is injected with a legal disclaimer indicating it is an automated aid and not a final legal certification.
- **Fail-safe Missing Images**: If a Cloudinary image fetch fails during generation, the PDF generator prints an error string ("Evidence image unavailable") rather than crashing the entire report rendering sequence.
- **No Overwriting**: Generating reports does NOT modify the underlying `Product` compliance result.

## Endpoints
- `GET /api/products/:id/report/pdf`
- `GET /api/products/:id/report/docx`
