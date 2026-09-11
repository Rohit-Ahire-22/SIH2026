import { Router } from 'express'
import {
  createProduct,
  listProducts,
  getProduct,
  getAnalytics,
  uploadProductImage,
} from '../controllers/productController.js'
import { uploadSingleProductImage } from '../config/multerConfig.js'
import { runProductOcr, runHybridProductOcr } from '../controllers/ocrController.js'
import { runProductAnalysis } from '../controllers/analysisController.js'
import { generatePdfReport, generateDocxReport } from '../controllers/reportController.js'
import { updateProductLocation } from '../controllers/locationController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

// Protect all product routes
router.use(authenticate)

router.post('/', createProduct)
router.get('/', listProducts)
router.get('/analytics', getAnalytics)
router.get('/:id', getProduct)
router.post('/:id/images', uploadSingleProductImage, uploadProductImage)
router.post('/:id/ocr', runProductOcr)
router.post('/:id/ocr/hybrid', runHybridProductOcr)
router.post('/:id/analyze', runProductAnalysis)

router.get('/:id/report/pdf', generatePdfReport)
router.get('/:id/report/docx', generateDocxReport)

// Optional location capture — does NOT affect compliance analysis
router.patch('/:id/location', updateProductLocation)

export default router
