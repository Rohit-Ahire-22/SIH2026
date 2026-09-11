import { Router } from 'express'
import {
  getViolationMap,
  getAreaSummaryController,
  getHighAttentionAreasController,
} from '../controllers/locationController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.get('/map', getViolationMap)
router.get('/summary', getAreaSummaryController)
router.get('/high-attention', getHighAttentionAreasController)

export default router
