import { Router } from 'express'
import { getViolationMap, getAreaSummaryController } from '../controllers/locationController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.get('/map', getViolationMap)
router.get('/summary', getAreaSummaryController)

export default router
