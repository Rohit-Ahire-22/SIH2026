# SIH 2026 - Legal Metrology Packaged Commodities Compliance Checker

**Problem Statement:** SIH26034

## Description

A software system to check the compliance of packaged commodities under the Legal Metrology (Packaged Commodities) Rules, 2011, by scanning products, images, and labels.

## Planned Architecture

- **Frontend:** React + Vite + Tailwind
- **Backend (API):** Node.js + Express
- **AI Service:** Python + FastAPI
- **Database:** MongoDB
- **Computer Vision / OCR:** OpenCV + YOLO + PaddleOCR
- **Intelligence:** RAG / LLM

## Intended Pipeline

```
Product image → OCR/CV → field extraction → product category → rule engine → compliance result → evidence → report
```

- Product image is scanned (camera upload / image).
- OCR/CV extracts visible text and fields from the label.
- Fields are structured/normalized into a standard schema.
- Product category is determined from the scanned content.
- The rule engine evaluates the fields against the Legal Metrology (Packaged Commodities) Rules, 2011.
- A compliance result (compliant / non-compliant) is produced.
- Evidence (images, extracted data, matched rules) is stored.
- A final compliance report is generated for the user.

## Repository Layout

- `client/` - React + Vite + Tailwind frontend
- `server/` - Node.js + Express API
- `ai-service/` - Python + FastAPI AI service
- `docs/` - documentation
