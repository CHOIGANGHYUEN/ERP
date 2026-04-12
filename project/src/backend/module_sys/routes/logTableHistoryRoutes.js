import express from 'express'
import logTableHistoryController from '../controllers/logTableHistoryController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, logTableHistoryController.getLogs)

export default router
