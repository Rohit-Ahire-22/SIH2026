import { Router } from 'express'
import healthRoutes from './healthRoutes.js'
import productRoutes from './productRoutes.js'
import authRoutes from './authRoutes.js'

const router = Router()

router.use('/health', healthRoutes)
router.use('/auth', authRoutes)
router.use('/products', productRoutes)

export default router