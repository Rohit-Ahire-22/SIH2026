import { HybridOcrService } from './hybridOcrService.js'
import { extractProductFields, extractEvidence } from './ocrFieldExtractionService.js'
import { detectProductCategory } from './productCategoryService.js'
import { evaluateRule6 } from '../legal/compliance/rule6ComplianceService.js'
import { evaluateRules789 } from '../legal/compliance/rule789ComplianceService.js'
import { evaluateRule11 } from '../legal/compliance/rule11ComplianceService.js'
import { VisualDetectionClient } from './visualDetectionClient.js'
import { EvidenceFusionService } from './evidenceFusionService.js'
import { MeasurementEvidenceService } from './measurementEvidenceService.js'
import Product from '../models/Product.js'

/**
 * Tracks per-stage timings for the whole analysis pipeline so the system can
 * identify the actual bottleneck before any optimization is attempted.
 */
export class AnalysisTimer {
  constructor() {
    this.stages = []
    this.startTime = Date.now()
    this._current = null
  }

  start(stage) {
    this._current = { stage, start: Date.now() }
  }

  end() {
    if (!this._current) return
    this.stages.push({ stage: this._current.stage, durationMs: Date.now() - this._current.start })
    this._current = null
  }

  stop() {
    if (this._current) this.end()
    this.stages.push({ stage: 'TOTAL', durationMs: Date.now() - this.startTime })
    return this.stages
  }
}

export function getOverallComplianceStatus(statuses) {
  if (!statuses || statuses.length === 0) return 'REVIEW'
  if (statuses.includes('FAIL')) return 'NON_COMPLIANT'
  
  // Any status that is not PASS or NOT_APPLICABLE should trigger REVIEW
  const invalidOrUncertain = statuses.filter(s => s !== 'PASS' && s !== 'NOT_APPLICABLE')
  if (invalidOrUncertain.length > 0) return 'REVIEW'

  // Now we only have PASS or NOT_APPLICABLE
  const passedCount = statuses.filter(s => s === 'PASS').length
  if (passedCount > 0) return 'COMPLIANT'
  
  // All rules are NOT_APPLICABLE
  return 'REVIEW'
}

// Mapping from structured evidence keys to the Product model fields that the
// compliance layer relies on.  Values identified only at REVIEW confidence are
// deliberately NOT written into the authoritative product fields (a REVIEW
// declaration must never be presented as a proven PASS).
const EVIDENCE_TO_PRODUCT_FIELD = {
  mrp: 'mrp',
  netQuantity: 'netQuantity',
  batchLotNumber: 'batchLotNumber',
  dateOfManufacture: 'dateOfManufacture',
  dateOfPacking: 'dateOfPacking',
  expiryOrUseByDate: 'expiryOrUseByDate',
  countryOfOrigin: 'countryOfOrigin',
  manufacturerName: 'manufacturerName',
  brandName: 'brandName',
  productName: 'productName',
}

function extractPlainValue(evidenceValue) {
  if (evidenceValue === null || evidenceValue === undefined) return null
  if (typeof evidenceValue === 'object') {
    if ('value' in evidenceValue) return evidenceValue.value
    if ('phone' in evidenceValue || 'email' in evidenceValue) return evidenceValue
  }
  return evidenceValue
}

export class AnalysisOrchestrationService {
  static async runFullAnalysis(productId, userId) {
    const timer = new AnalysisTimer()
    const product = await Product.findOne({ _id: productId, userId })
    if (!product) throw new Error(`Product not found: ${productId}`)

    product.analysisStatus = 'PROCESSING'
    product.analysisError = null
    await product.save()

    try {
      if (!product.images || product.images.length === 0) {
        throw new Error('Product has no images to analyze.')
      }

      const image = product.images[product.images.length - 1]

      // 1. OCR (Hybrid)
      timer.start('ocr')
      let ocrDetections = []
      // These are populated from the hybridResponse and reused for visual detection (Opt 2).
      let hybridImageBuffer = null
      let hybridMimeType = image.mimeType || 'image/jpeg'
      try {
        const hybridResponse = await HybridOcrService.runHybridOcr(image.url, image.mimeType)
        ocrDetections = hybridResponse.results || []
        // Capture the image buffer returned by hybridOcrService so the orchestrator
        // can reuse it for visual detection without a second Cloudinary download (Opt 2).
        hybridImageBuffer = hybridResponse.imageBuffer || null
        hybridMimeType   = hybridResponse.mimeType   || image.mimeType || 'image/jpeg'
        
        product.ocrText = ocrDetections.map((r) => r.text).join('\n')
        product.ocrResults.push({
          imageIndex: product.images.length - 1,
          imageUrl: image.url,
          publicId: image.publicId,
          results: ocrDetections,
          processedAt: new Date(),
        })
        timer.end()
      } catch (ocrErr) {
        timer.end()
        console.error("OCR Failed:", ocrErr)
        product.analysisError = "OCR Service Unavailable or Failed: " + ocrErr.message
        // We do NOT throw. We let it fail gracefully into a REVIEW state.
      }

      // Derive image dimensions for implicit region hints (from hybrid response
      // when available; never required).
      const imageDimensions = hybridOcrDimensions(ocrDetections)

      // 2. Field Extraction (explicit + implicit with provenance)
      timer.start('extraction')
      let extracted = {}
      let evidence = {}
      if (ocrDetections.length > 0) {
        extracted = extractProductFields(ocrDetections)
        evidence = extractEvidence(ocrDetections, { imageDimensions }, extracted)

        // Save the raw rich extraction objects to metadata for compliance/evidence tracking
        product.metadata = product.metadata || {}
        product.metadata.extractedFields = extracted
        product.metadata.evidence = evidence

        // Apply fields deterministically without fabricating if missing.
        // Uses the RICH export (explicit + high-confidence implicit): a value
        // is only written to the authoritative product field when it is a
        // present & confident declaration, never a REVIEW.
        applyEvidenceToProduct(product, extracted, evidence)
        timer.end()
      } else {
        timer.end()
      }

      // 2b. Visual Detection & Fusion
      timer.start('visual_fusion')
      let visualResult = null
      let fusedEvidence = null
      try {
        // Use the image buffer captured from the OCR step to avoid a second Cloudinary
        // download.  Fall back to URL-based detection if the buffer was not propagated
        // (e.g. OCR failed before returning a response).
        if (hybridImageBuffer) {
          visualResult = await VisualDetectionClient.detectVisualElementsFromBuffer(hybridImageBuffer, hybridMimeType)
        } else {
          visualResult = await VisualDetectionClient.detectVisualElements(image.url)
        }
        fusedEvidence = EvidenceFusionService.fuseEvidence(evidence, visualResult, ocrDetections)
        if (!product.metadata) product.metadata = {}
        product.metadata.visualEvidence = visualResult
        product.metadata.fusedEvidence = fusedEvidence
      } catch (visualErr) {
        console.error("Visual Detection/Fusion Failed:", visualErr)
        // Degrade gracefully
      } finally {
        timer.end()
      }

      // 2c. Measurement Evidence
      const legalContext = {
        consumerType: 'RETAIL',
        packageType: 'PRE_PACKAGED',
        importStatus: 'DOMESTIC',
        quantityValue: product.netQuantity?.value,
        quantityUnit: product.netQuantity?.unit,
        asOfDate: new Date()
      }
      timer.start('measurement')
      let measurementEvidence = null
      try {
        measurementEvidence = MeasurementEvidenceService.extractMeasurementEvidence(extracted, ocrDetections, legalContext)
        if (!product.metadata) product.metadata = {}
        product.metadata.measurementEvidence = measurementEvidence
      } catch (measureErr) {
        console.error("Measurement Extraction Failed:", measureErr)
      } finally {
        timer.end()
      }

      // 3. Category Detection
      timer.start('category')
      const categoryContext = {
        productName: product.productName,
        brandName: product.brandName,
        manufacturerName: product.manufacturerName,
        ocrResults: ocrDetections,
        extracted,
      }
      const categoryResult = detectProductCategory(categoryContext)
      product.category = categoryResult.category
      product.categoryConfidence = categoryResult.confidence
      product.categoryMatchedKeywords = categoryResult.matchedSignals.map(s => 
        `${s.category}: ${s.signal} -> ${s.layer} -> +${s.weight}`
      )
      product.categoryDetectionStatus = categoryResult.status
      timer.end()

      // 4. Legal Metrology Applicability & Rule Evaluation
      // Default to assuming RETAIL consumer type unless overridden by user manually
      legalContext.domain = categoryResult.category // Do not default unknown to 'food'

      timer.start('rule6')
      const r6 = evaluateRule6({ product: product.toObject(), context: legalContext, asOfDate: new Date() })
      timer.end()

      timer.start('rule789')
      const r789 = evaluateRules789({ product: product.toObject(), context: legalContext, fusedEvidence, measurementEvidence, asOfDate: new Date() })
      timer.end()

      timer.start('rule11')
      const r11 = await evaluateRule11(product.toObject(), legalContext, new Date())
      timer.end()

      const overallStatus = getOverallComplianceStatus([r6.status, r789.status, r11.status])
      
      product.complianceStatus = overallStatus
      product.complianceDetails = {
        rule6: r6,
        rule789: r789,
        rule11: r11,
        evaluatedAt: new Date(),
        legalContext
      }

      const timings = timer.stop()
      product.analysisTimings = timings
      product.metadata = product.metadata || {}
      product.metadata.analysisTimings = timings

      product.analysisStatus = 'COMPLETED'
      await product.save()

      return product
    } catch (err) {
      console.error("Analysis Orchestration Failed:", err)
      product.analysisStatus = 'FAILED'
      product.analysisError = err.message
      product.complianceStatus = 'REVIEW'
      try { await product.save() } catch (_) {}
      throw err
    }
  }
}

/**
 * Applies extracted evidence to the authoritative Product fields.
 * Only values that are structurally valid declarations (status PASS or
 * equivalent) are written; REVIEW/UNKNOWN declarations are retained in
 * metadata only and never promoted to proven product evidence.
 */
function applyEvidenceToProduct(product, extracted, evidence) {
  const write = (field, value) => {
    if (value !== null && value !== undefined && value !== 'REVIEW') {
      product[field] = value
    }
  }

  if (evidence.mrp && evidence.mrp.status === 'PASS' && evidence.mrp.value) {
    write('mrp', evidence.mrp.value.value ?? evidence.mrp.value)
  } else if (extracted.mrp != null && extracted.mrp.value !== 'REVIEW' &&
             (extracted.mrp.confidence === undefined || extracted.mrp.confidence >= 0.8)) {
    write('mrp', extracted.mrp.value)
  }

  if (evidence.netQuantity && evidence.netQuantity.status === 'PASS' && evidence.netQuantity.value) {
    write('netQuantity', { value: evidence.netQuantity.value.value, unit: evidence.netQuantity.value.unit })
  } else if (extracted.netQuantity != null && extracted.netQuantity.value !== 'REVIEW') {
    product.netQuantity = { value: extracted.netQuantity.value, unit: extracted.netQuantity.unit }
  }

  if (extracted.batchLotNumber != null && extracted.batchLotNumber.value !== 'REVIEW') write('batchLotNumber', extracted.batchLotNumber.value)
  if (extracted.dateOfManufacture != null && extracted.dateOfManufacture.value !== 'REVIEW') write('dateOfManufacture', extracted.dateOfManufacture.value)
  if (extracted.dateOfPacking != null && extracted.dateOfPacking.value !== 'REVIEW') write('dateOfPacking', extracted.dateOfPacking.value)
  if (extracted.expiryOrUseByDate != null && extracted.expiryOrUseByDate.value !== 'REVIEW') write('expiryOrUseByDate', extracted.expiryOrUseByDate.value)
  if (extracted.countryOfOrigin != null && extracted.countryOfOrigin.value !== 'REVIEW') write('countryOfOrigin', extracted.countryOfOrigin.value)
  if (extracted.manufacturerName != null && extracted.manufacturerName.value !== 'REVIEW') write('manufacturerName', extracted.manufacturerName.value)
  if (extracted.consumerCareDetails != null && extracted.consumerCareDetails.value !== 'REVIEW') {
    product.consumerCareDetails = {
      ...(product.consumerCareDetails || {}),
      ...extracted.consumerCareDetails.value,
    }
  }
  if (extracted.brandName != null && extracted.brandName.value !== 'REVIEW') write('brandName', extracted.brandName.value)
  if (extracted.productName != null && extracted.productName.value !== 'REVIEW') write('productName', extracted.productName.value)
}

/**
 * Attempts to recover image dimensions from OCR detections when the response
 * did not carry them explicitly (derived from the bbox coordinate space).
 */
function hybridOcrDimensions(ocrDetections) {
  if (!ocrDetections || !ocrDetections.length) return null
  let maxX = 0, maxY = 0
  for (const det of ocrDetections) {
    if (det.bbox && Array.isArray(det.bbox)) {
      for (const pt of det.bbox) {
        if (pt && pt.length >= 2) {
          if (pt[0] > maxX) maxX = pt[0]
          if (pt[1] > maxY) maxY = pt[1]
        }
      }
    }
  }
  if (maxX === 0 && maxY === 0) return null
  return { width: Math.ceil(maxX * 1.1), height: Math.ceil(maxY * 1.1) }
}
