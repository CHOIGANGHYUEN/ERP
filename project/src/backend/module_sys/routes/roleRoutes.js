import express from 'express'
import roleController from '../controllers/roleController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, roleController.getAllRoles)
router.get('/:id', verifyToken, roleController.getRoleById)
router.post('/', verifyToken, roleController.createRole)
router.put('/:id', verifyToken, roleController.updateRole)
router.delete('/:id', verifyToken, roleController.deleteRole)

router.get('/:id/menus', verifyToken, roleController.getRoleMenus)
router.put('/:id/menus', verifyToken, roleController.updateRoleMenus)
router.get('/:id/users', verifyToken, roleController.getRoleUsers)
router.put('/:id/users', verifyToken, roleController.updateRoleUsers)

export default router
