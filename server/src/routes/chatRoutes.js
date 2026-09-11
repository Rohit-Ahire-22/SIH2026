import { Router } from 'express'
import { askQuestion } from '../controllers/chatController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

router.use(authenticate)

router.post('/ask', askQuestion)

export default router
