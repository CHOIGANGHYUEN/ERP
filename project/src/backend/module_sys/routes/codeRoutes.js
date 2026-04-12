import express from 'express'
import codeController from '../controllers/codeController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, codeController.getCodeHeads)
router.get('/:categoryCode/:groupCode', verifyToken, codeController.getCodeHeadDetail)
router.post('/', verifyToken, codeController.saveCodeGroup)
router.delete('/:categoryCode/:groupCode', verifyToken, codeController.deleteCodeGroup)

export default router