# ROI Strategy Comparison

This report details three strategies for solving the bounding box annotation bottleneck to ultimately train a YOLO Region of Interest (ROI) detector for SIH26034.

## Strategies

### Strategy A: Manual Annotation Only
- **Approach**: The user downloads LabelImg and physically draws boxes on all current and future images.
- **Manual Effort**: Extreme (Minutes per image, unscalable for 5,000+ images).
- **Technical Complexity**: Low (Standard process).
- **Licensing Risk**: Zero.
- **SIH Defensibility**: High (Fully proprietary, highly accurate dataset).
- **Implementation Cost**: Pure human hours.

### Strategy B: External Dataset + Manual
- **Approach**: We scrape/download Open Food Facts (OFF) or FineGrainOCR and directly merge their annotations.
- **Manual Effort**: Low.
- **Technical Complexity**: Moderate (Requires mapping scripts and adapter interfaces).
- **Licensing Risk**: High (Commercial use of OFF requires share-alike; FineGrainOCR is research-only).
- **SIH Defensibility**: Very Low (The external labels do not map to our custom Legal Metrology `declaration_panel`).

### Strategy C: Weak Supervision + Manual
- **Approach**: Use our existing OCR architecture to detect text, run heuristic Regex rules to find legal keywords, geometrically group those boxes, and generate a pseudo-label candidate for `declaration_panel`. A human then rapidly approves or slightly nudges the candidate.
- **Manual Effort**: Very Low (Seconds per image to verify).
- **Technical Complexity**: High (Requires geometric math, Regex integration, and isolated pipeline management).
- **Licensing Risk**: Zero (We are bootstrapping off our own proprietary images).
- **SIH Defensibility**: Extremely High (Shows advanced pipeline automation and programmatic scalability).

## Recommendation
**Strategy C (Weak Supervision) is unequivocally the best path forward.** 

It leverages our existing investment in the PaddleOCR pipeline, sidesteps complex licensing pitfalls from external data scraping, and exponentially accelerates the human annotation workflow by generating pre-computed `weak_candidate` labels that merely require a human rubber-stamp of approval. 

We will proceed with building the `weakRoiCandidateService.js` to realize Strategy C.
