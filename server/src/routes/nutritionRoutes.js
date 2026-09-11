import { Router } from 'express'
import {
  uploadAndScan,
  listScans,
  getScan,
  compareScans,
  generateRecommendations,
  getScanRecommendations,
  nutritionUpload,
  handleNutritionUploadError,
} from '../controllers/nutritionController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

router.use(authenticate)

// Upload + scan
router.post('/scan', (req, res, next) => {
  nutritionUpload.single('nutrition_image')(req, res, (err) => {
    if (err) return handleNutritionUploadError(err, res)
    next()
  })
}, uploadAndScan)

// List own scans
router.get('/scans', listScans)

// Single scan
router.get('/scans/:id', getScan)

// Recommendations for an owned scan
router.post('/scans/:id/recommend', generateRecommendations)
router.get('/scans/:id/recommendations', getScanRecommendations)

// Comparison
router.get('/compare', compareScans)

export default router
