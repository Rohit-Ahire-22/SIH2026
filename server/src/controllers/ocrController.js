import mongoose from 'mongoose'
import Product from '../models/Product.js'
import { runOcrOnImageUrl } from '../services/ocrClientService.js'
import { extractProductFields } from '../services/ocrFieldExtractionService.js'
import { detectProductCategory } from '../services/productCategoryService.js'
import { HybridOcrService } from '../services/hybridOcrService.js'

export async function runProductOcr(req, res, next) {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid product id: ${id}`,
    })
  }

  try {
    const product = await Product.findOne({ _id: id, userId: req.user.userId })
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id: ${id}`,
      })
    }

    if (!product.images || product.images.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'Product has no images to run OCR on. Upload an image first.',
        code: 'NO_PRODUCT_IMAGES',
      })
    }

    const image = product.images[product.images.length - 1]

    const results = await runOcrOnImageUrl(image.url, image.mimeType)

    product.ocrText = results.map((r) => r.text).join('\n')

    const extracted = extractProductFields(results)
    applyExtractedFields(product, extracted)

    const category = detectProductCategory({
      productName: product.productName,
      brandName: product.brandName,
      manufacturerName: product.manufacturerName,
      ocrResults: results,
      extracted,
    })
    product.category = category.category
    product.categoryConfidence = category.confidence
    product.categoryMatchedKeywords = category.matchedKeywords
    product.categoryDetectionStatus = category.status

    product.ocrResults.push({
      imageIndex: product.images.length - 1,
      imageUrl: image.url,
      publicId: image.publicId,
      results,
      processedAt: new Date(),
    })

    await product.save()

    const stored = product.ocrResults[product.ocrResults.length - 1]

    return res.status(200).json({
      success: true,
      message: 'OCR completed successfully',
      data: {
        productId: product.id,
        image: {
          url: image.url,
          publicId: image.publicId,
          mimeType: image.mimeType,
        },
        ocr: {
          processedAt: stored.processedAt,
          count: stored.results.length,
          results: stored.results,
        },
        extracted,
        category,
      },
    })
  } catch (err) {
    return next(err)
  }
}

function applyExtractedFields(product, extracted) {
  if (extracted.mrp != null) product.mrp = extracted.mrp
  if (extracted.netQuantity != null) product.netQuantity = extracted.netQuantity
  if (extracted.batchLotNumber != null) {
    product.batchLotNumber = extracted.batchLotNumber
  }
  if (extracted.dateOfManufacture != null) {
    product.dateOfManufacture = extracted.dateOfManufacture
  }
  if (extracted.dateOfPacking != null) {
    product.dateOfPacking = extracted.dateOfPacking
  }
  if (extracted.expiryOrUseByDate != null) {
    product.expiryOrUseByDate = extracted.expiryOrUseByDate
  }
  if (extracted.countryOfOrigin != null) {
    product.countryOfOrigin = extracted.countryOfOrigin
  }
  if (extracted.manufacturerName != null) {
    product.manufacturerName = extracted.manufacturerName
  }
  if (extracted.consumerCareDetails != null) {
    product.consumerCareDetails = {
      ...(product.consumerCareDetails || {}),
      ...extracted.consumerCareDetails,
    }
  }
}

export async function runHybridProductOcr(req, res, next) {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid product id: ${id}`,
    })
  }

  try {
    const product = await Product.findOne({ _id: id, userId: req.user.userId })
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id: ${id}`,
      })
    }

    if (!product.images || product.images.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'Product has no images to run OCR on. Upload an image first.',
        code: 'NO_PRODUCT_IMAGES',
      })
    }

    const image = product.images[product.images.length - 1]

    const hybridResponse = await HybridOcrService.runHybridOcr(image.url, image.mimeType)
    const fusedResults = hybridResponse.results

    product.ocrText = fusedResults.map((r) => r.text).join('\n')

    const extracted = extractProductFields(fusedResults)
    applyExtractedFields(product, extracted)

    const category = detectProductCategory({
      productName: product.productName,
      brandName: product.brandName,
      manufacturerName: product.manufacturerName,
      ocrResults: fusedResults,
      extracted,
    })
    product.category = category.category
    product.categoryConfidence = category.confidence
    product.categoryMatchedKeywords = category.matchedKeywords
    product.categoryDetectionStatus = category.status

    product.ocrResults.push({
      imageIndex: product.images.length - 1,
      imageUrl: image.url,
      publicId: image.publicId,
      results: fusedResults,
      processedAt: new Date(),
    })

    await product.save()

    const stored = product.ocrResults[product.ocrResults.length - 1]

    return res.status(200).json({
      ...hybridResponse,
      message: 'Hybrid OCR completed successfully',
      data: {
        productId: product.id,
        image: {
          url: image.url,
          publicId: image.publicId,
          mimeType: image.mimeType,
        },
        ocr: {
          processedAt: stored.processedAt,
          count: stored.results.length,
          results: stored.results,
        },
        extracted,
        category,
      },
      results: undefined // Remove from top level, moved to data.ocr.results
    })
  } catch (err) {
    return next(err)
  }
}