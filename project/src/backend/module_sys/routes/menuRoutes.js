import express from 'express'
import menuController from '../controllers/menuController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/usermenus', verifyToken, menuController.getUserMenus)

router.get('/', verifyToken, menuController.getAllMenus)
router.post('/', verifyToken, menuController.createMenu)
router.get('/:id', verifyToken, menuController.getMenuById)
router.put('/:id', verifyToken, menuController.updateMenu)
router.delete('/:id', verifyToken, menuController.deleteMenu)

export default router
