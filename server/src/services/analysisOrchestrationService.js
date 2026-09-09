import { HybridOcrService } from './hybridOcrService.js'
import { extractProductFields } from './ocrFieldExtractionService.js'
import { detectProductCategory } from './productCategoryService.js'
import { evaluateRule6 } from '../legal/compliance/rule6ComplianceService.js'
import { evaluateRules789 } from '../legal/compliance/rule789ComplianceService.js'
import { evaluateRule11 } from '../legal/compliance/rule11ComplianceService.js'
import Product from '../models/Product.js'

function getOverallComplianceStatus(statuses) {
  if (statuses.includes('FAIL')) return 'NON_COMPLIANT'
  if (statuses.includes('REVIEW') || statuses.includes('PENDING')) return 'REVIEW'
  
  const applicableStatuses = statuses.filter(s => s === 'PASS' || s === 'FAIL')
  if (applicableStatuses.length === 0) return 'REVIEW' // No confidently applicable rules

  return 'COMPLIANT'
}

export class AnalysisOrchestrationService {
  static async runFullAnalysis(productId) {
    const product = await Product.findById(productId)
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
      let ocrDetections = []
      try {
        const hybridResponse = await HybridOcrService.runHybridOcr(image.url, image.mimeType)
        ocrDetections = hybridResponse.results || []
        
        product.ocrText = ocrDetections.map((r) => r.text).join('\n')
        product.ocrResults.push({
          imageIndex: product.images.length - 1,
          imageUrl: image.url,
          publicId: image.publicId,
          results: ocrDetections,
          processedAt: new Date(),
        })
      } catch (ocrErr) {
        console.error("OCR Failed:", ocrErr)
        product.analysisError = "OCR Service Unavailable or Failed: " + ocrErr.message
        // We do NOT throw. We let it fail gracefully into a REVIEW state.
      }

      // 2. Field Extraction
      let extracted = {}
      if (ocrDetections.length > 0) {
        extracted = extractProductFields(ocrDetections)
        
        // Save the raw rich extraction objects to metadata for compliance/evidence tracking
        product.metadata = product.metadata || {}
        product.metadata.extractedFields = extracted

        // Apply fields deterministically without fabricating if missing
        if (extracted.mrp != null && extracted.mrp.value !== 'REVIEW') product.mrp = extracted.mrp.value
        if (extracted.netQuantity != null && extracted.netQuantity.value !== 'REVIEW') {
           product.netQuantity = { value: extracted.netQuantity.value, unit: extracted.netQuantity.unit }
        }
        if (extracted.batchLotNumber != null && extracted.batchLotNumber.value !== 'REVIEW') product.batchLotNumber = extracted.batchLotNumber.value
        if (extracted.dateOfManufacture != null && extracted.dateOfManufacture.value !== 'REVIEW') product.dateOfManufacture = extracted.dateOfManufacture.value
        if (extracted.dateOfPacking != null && extracted.dateOfPacking.value !== 'REVIEW') product.dateOfPacking = extracted.dateOfPacking.value
        if (extracted.expiryOrUseByDate != null && extracted.expiryOrUseByDate.value !== 'REVIEW') product.expiryOrUseByDate = extracted.expiryOrUseByDate.value
        if (extracted.countryOfOrigin != null && extracted.countryOfOrigin.value !== 'REVIEW') product.countryOfOrigin = extracted.countryOfOrigin.value
        if (extracted.manufacturerName != null && extracted.manufacturerName.value !== 'REVIEW') product.manufacturerName = extracted.manufacturerName.value
        if (extracted.consumerCareDetails != null && extracted.consumerCareDetails.value !== 'REVIEW') {
          product.consumerCareDetails = {
            ...(product.consumerCareDetails || {}),
            ...extracted.consumerCareDetails.value,
          }
        }
        if (extracted.brandName != null && extracted.brandName.value !== 'REVIEW') product.brandName = extracted.brandName.value
        if (extracted.productName != null && extracted.productName.value !== 'REVIEW') product.productName = extracted.productName.value
      }

      // 3. Category Detection
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

      // 4. Legal Metrology Applicability & Rule Evaluation
      // Default to assuming RETAIL consumer type unless overridden by user manually
      const legalContext = {
        consumerType: 'RETAIL',
        packageType: 'PRE_PACKAGED',
        importStatus: 'DOMESTIC',
        domain: categoryResult.category, // Do not default unknown to 'food'
        quantityValue: product.netQuantity?.value,
        quantityUnit: product.netQuantity?.unit,
        asOfDate: new Date()
      }

      const r6 = evaluateRule6({ product: product.toObject(), context: legalContext, asOfDate: new Date() })
      const r789 = evaluateRules789({ product: product.toObject(), context: legalContext, asOfDate: new Date() })
      const r11 = await evaluateRule11(product.toObject(), legalContext, new Date())

      const overallStatus = getOverallComplianceStatus([r6.status, r789.status, r11.status])
      
      product.complianceStatus = overallStatus
      product.complianceDetails = {
        rule6: r6,
        rule789: r789,
        rule11: r11,
        evaluatedAt: new Date(),
        legalContext
      }

      product.analysisStatus = 'COMPLETED'
      await product.save()

      return product
    } catch (err) {
      console.error("Analysis Orchestration Failed:", err)
      product.analysisStatus = 'FAILED'
      product.analysisError = err.message
      product.complianceStatus = 'REVIEW'
      await product.save()
      throw err
    }
  }
}
