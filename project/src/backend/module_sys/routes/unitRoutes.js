import express from 'express'
import unitController from '../controllers/unitController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()
router.get('/', verifyToken, unitController.getList)
router.get('/:id', verifyToken, unitController.getDetail)
router.post('/', verifyToken, unitController.save)
router.delete('/:id', verifyToken, unitController.remove)

export default router
