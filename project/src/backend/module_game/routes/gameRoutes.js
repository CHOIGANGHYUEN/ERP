import express from 'express'
import { saveWorld, loadWorlds } from '../controllers/gameController.js'

const router = express.Router()

router.post('/world', saveWorld)
router.get('/worlds', loadWorlds)

export default router
