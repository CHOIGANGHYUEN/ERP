import express from 'express'
import logLoginUserController from '../controllers/logLoginUserController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, logLoginUserController.getLogs)

export default router
