import express from 'express'
import logUserController from '../controllers/logUserController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, logUserController.getLogs)

export default router
