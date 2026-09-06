# Dashboard Analytics API (v1)

This document outlines the SIH26034 analytics engine that drives the compliance dashboard.

## Architecture

1. **Aggregation Over Iteration**: The analytics API (`GET /api/products/analytics`) exclusively uses native MongoDB `$aggregate` pipelines. It never pulls thousands of Product records into Node.js memory.
2. **Date Filtering**: Users can filter aggregations using the `?days=` query parameter. The parameter is safely parsed as an integer to prevent `$where` or regex injection.
3. **No ML Triggering**: Analytics are read-only. Accessing the dashboard does not trigger PaddleOCR, FastAPI, or the compliance rules engine.

## API Response Structure

The endpoint returns four distinct aggregated blocks:

1. **`summary`**: Flat counts of `total`, `pass`, `fail`, `review`, and `pending`.
2. **`complianceDistribution`**: Flattened object mapping status keys (`PASS`, `FAIL`, `REVIEW`) to their total counts.
3. **`categoryBreakdown`**: Array of categories sorted by descending total volume. Includes nested pass/fail/review counts per category.
4. **`trend`**: Array of daily timestamps (e.g., `2026-09-01`) mapping to the inspection activity of that day.

## Frontend Visualization

To maintain high performance and prevent bundle bloat:
- **Pass Rate**: Calculated on the fly from the `summary` object.
- **Distribution Bar**: Rendered natively using a Tailwind CSS Flex container with percentage widths.
- **Trend Chart**: Rendered natively using CSS Flex columns growing from the bottom, hovering to reveal tooltips. No heavy canvas charting libraries (like Chart.js or Recharts) were imported.
