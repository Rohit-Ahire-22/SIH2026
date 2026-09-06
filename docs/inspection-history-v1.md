# Inspection History API (v1)

This document describes the SIH26034 backend support for the historical product inspection repository.

## Architecture

1. **Pagination**: Uses standard offset-limit pagination mapping directly to Mongoose `.skip()` and `.limit()`. The maximum limit is clamped at 100 to prevent runaway memory usage.
2. **Safe Regex Searching**: When users search for brand or product names, the string is explicitly escaped before wrapping it in `new RegExp()` to prevent arbitrary regex injection attacks targeting the Mongo engine.
3. **Payload Optimization**: Large embedded arrays (`ocrResults.results`) are excluded from the `Product.find().select()` projection to drastically reduce the JSON payload size when listing 50+ products on a single page.
4. **Dashboard Stats**: The `/api/products/stats` endpoint queries MongoDB `countDocuments` instead of downloading massive product lists into memory for aggregation, ensuring fast dashboard loads.

## API Endpoints

### `GET /api/products`
- **Query Params**:
  - `page` (default: 1)
  - `limit` (default: 20, max: 100)
  - `search` (text string)
  - `status` (`PASS`, `FAIL`, `REVIEW`, `PENDING`)
  - `category` (enum)
  - `analysisStatus` (enum)
  - `sort` (default: `createdAt`)
  - `order` (`asc`, `desc`)

### `GET /api/products/stats`
Returns aggregated quick counts: Total, PASS, FAIL, REVIEW.

## Database Indexes
New indices added to the `Product` schema in Mongoose:
- `{ createdAt: -1 }`
- `{ category: 1 }`
- `{ manufacturerName: 1 }`
(Along with existing indices on `complianceStatus` and `analysisStatus`).
