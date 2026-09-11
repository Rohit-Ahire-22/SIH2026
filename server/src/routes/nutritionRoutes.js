import { Router } from 'express'
import {
  uploadAndScan,
  listScans,
  getScan,
  compareScans,
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

// Comparison
router.get('/compare', compareScans)

export default router
