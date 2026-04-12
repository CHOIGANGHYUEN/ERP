import express from 'express'
import plantController from '../controllers/plantController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()
router.get('/', verifyToken, plantController.getList)
router.get('/:id', verifyToken, plantController.getDetail)
router.post('/', verifyToken, plantController.save)
router.delete('/:id', verifyToken, plantController.remove)

export default router
