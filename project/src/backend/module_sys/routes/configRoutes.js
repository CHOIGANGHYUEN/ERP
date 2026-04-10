import express from 'express'
import configController from '../controllers/configController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, configController.getAllConfigs)
router.post('/', verifyToken, configController.createConfig)
router.get('/:id', verifyToken, configController.getConfigById)
router.put('/:id', verifyToken, configController.updateConfig)
router.delete('/:id', verifyToken, configController.deleteConfig)

export default router
