import { HybridOcrService } from './hybridOcrService.js'
import { extractProductFields } from './ocrFieldExtractionService.js'
import { detectProductCategory } from './productCategoryService.js'
import { evaluateRule6 } from '../legal/compliance/rule6ComplianceService.js'
import { evaluateRules789 } from '../legal/compliance/rule789ComplianceService.js'
import { evaluateRule11 } from '../legal/compliance/rule11ComplianceService.js'
import Product from '../models/Product.js'

function getWorstStatus(statuses) {
  const rank = { 'FAIL': 1, 'REVIEW': 2, 'PASS': 3, 'NOT_APPLICABLE': 4, 'PENDING': 5 }
  return statuses.sort((a, b) => (rank[a] || 5) - (rank[b] || 5))[0] || 'REVIEW'
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
        // Apply fields deterministically without fabricating if missing
        if (extracted.mrp != null) product.mrp = extracted.mrp
        if (extracted.netQuantity != null) product.netQuantity = extracted.netQuantity
        if (extracted.batchLotNumber != null) product.batchLotNumber = extracted.batchLotNumber
        if (extracted.dateOfManufacture != null) product.dateOfManufacture = extracted.dateOfManufacture
        if (extracted.dateOfPacking != null) product.dateOfPacking = extracted.dateOfPacking
        if (extracted.expiryOrUseByDate != null) product.expiryOrUseByDate = extracted.expiryOrUseByDate
        if (extracted.countryOfOrigin != null) product.countryOfOrigin = extracted.countryOfOrigin
        if (extracted.manufacturerName != null) product.manufacturerName = extracted.manufacturerName
        if (extracted.consumerCareDetails != null) {
          product.consumerCareDetails = {
            ...(product.consumerCareDetails || {}),
            ...extracted.consumerCareDetails,
          }
        }
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
      product.categoryMatchedKeywords = categoryResult.matchedKeywords
      product.categoryDetectionStatus = categoryResult.status

      // 4. Legal Metrology Applicability & Rule Evaluation
      // Default to assuming RETAIL consumer type unless overridden by user manually
      const legalContext = {
        consumerType: 'RETAIL',
        packageType: 'PRE_PACKAGED',
        importStatus: 'DOMESTIC',
        domain: categoryResult.category !== 'unknown' ? categoryResult.category : 'food',
        quantityValue: product.netQuantity?.value,
        quantityUnit: product.netQuantity?.unit,
        asOfDate: new Date()
      }

      const r6 = evaluateRule6({ product: product.toObject(), context: legalContext, asOfDate: new Date() })
      const r789 = evaluateRules789({ product: product.toObject(), context: legalContext, asOfDate: new Date() })
      const r11 = await evaluateRule11(product.toObject(), legalContext, new Date())

      const overallStatus = getWorstStatus([r6.status, r789.status, r11.status])
      
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
