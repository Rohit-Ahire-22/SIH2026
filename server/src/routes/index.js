import { Router } from 'express'
import healthRoutes from './healthRoutes.js'
import productRoutes from './productRoutes.js'
import authRoutes from './authRoutes.js'
import complaintRoutes from './complaintRoutes.js'
import violationRoutes from './violationRoutes.js'
import nutritionRoutes from './nutritionRoutes.js'
import chatRoutes from './chatRoutes.js'

const router = Router()

router.use('/health', healthRoutes)
router.use('/auth', authRoutes)
router.use('/products', productRoutes)
router.use('/complaints', complaintRoutes)
router.use('/violations', violationRoutes)
router.use('/nutrition', nutritionRoutes)
router.use('/chat', chatRoutes)

export default router