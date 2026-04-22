import express from 'express'
import authController from '../controllers/authController.js'

import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.post('/google', authController.googleLogin)
router.post('/logout', authController.logout)
router.get('/me', verifyToken, authController.getMe)

export default router
