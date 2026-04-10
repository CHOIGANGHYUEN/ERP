import express from 'express'
import {
  getTableList,
  getTableDetail,
  saveTableSpec,
  generateSql,
} from '../controllers/tableSpecController.js'

const router = express.Router()

router.get('/', getTableList)
router.get('/:tablen', getTableDetail)
router.post('/', saveTableSpec)
router.post('/:tablen/generate-sql', generateSql)

export default router
