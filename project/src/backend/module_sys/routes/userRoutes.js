import express from 'express'
import userController from '../controllers/userController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, userController.getUsers)
router.get('/:id', verifyToken, userController.getUserDetail)
router.post('/', verifyToken, userController.saveUser)
router.delete('/:id', verifyToken, userController.deleteUser)

export default router