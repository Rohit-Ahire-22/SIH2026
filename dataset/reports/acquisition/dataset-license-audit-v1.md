# Dataset License Audit v1

## Overview
This document enforces strict licensing compliance for dataset acquisition, explicitly blocking unauthorized scraping of commercial platforms to protect the integrity of the SIH26034 proprietary pipeline.

## Approved Sources

### 1. Proprietary Smartphone Collection
- **Status**: `APPROVED`
- **License**: Proprietary (Owned by User/SIH)
- **Intended Use**: `GROUND_TRUTH`, `TRAINING`, `VALIDATION`, `TEST`
- **Notes**: Safe for all operations. No redistribution restrictions internally.

## Conditional Sources

### 2. Open Food Facts
- **Status**: `CONDITIONAL`
- **License**: `CC-BY-SA 3.0`
- **Intended Use**: `PRETRAINING_SUPPORT`
- **Notes**: Must attribute Open Food Facts. Due to ShareAlike obligations, Open Food Facts data cannot be seamlessly mixed with proprietary Indian legal-label ground truth if the dataset is ever published. It must remain partitioned.

## Rejected / Blocked Sources

### 3. Amazon India, Flipkart, E-commerce
- **Status**: `REJECTED`
- **License**: All Rights Reserved / Copyrighted
- **Notes**: Explicitly blocked. Terms of Service prohibit automated scraping. 

### 4. Google/Bing Images
- **Status**: `REJECTED`
- **License**: Unknown
- **Notes**: Provenance cannot be guaranteed. Blocked from pipeline.
