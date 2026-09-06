import mongoose from 'mongoose'
import { AnalysisOrchestrationService } from '../services/analysisOrchestrationService.js'

export async function runProductAnalysis(req, res, next) {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid product id: ${id}`,
    })
  }

  try {
    const product = await AnalysisOrchestrationService.runFullAnalysis(id)

    return res.status(200).json({
      success: true,
      message: 'Analysis completed',
      data: {
        productId: product.id,
        analysisStatus: product.analysisStatus,
        complianceStatus: product.complianceStatus,
        complianceDetails: product.complianceDetails,
        extracted: {
          mrp: product.mrp,
          netQuantity: product.netQuantity,
          batchLotNumber: product.batchLotNumber,
          dateOfManufacture: product.dateOfManufacture,
          dateOfPacking: product.dateOfPacking,
          expiryOrUseByDate: product.expiryOrUseByDate,
          countryOfOrigin: product.countryOfOrigin,
          manufacturerName: product.manufacturerName,
          consumerCareDetails: product.consumerCareDetails,
        },
        category: {
          category: product.category,
          confidence: product.categoryConfidence,
          status: product.categoryDetectionStatus,
        }
      },
    })
  } catch (err) {
    if (err.message.includes('Product not found')) {
      return res.status(404).json({ success: false, message: err.message })
    }
    return next(err)
  }
}
