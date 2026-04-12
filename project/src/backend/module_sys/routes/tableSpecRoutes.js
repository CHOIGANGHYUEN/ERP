import express from 'express'
import {
  getTableList,
  getTableDetail,
  saveTableSpec,
  generateSql,
  generateInsertSql,
  generateUpdateSql,
  executeSql,
} from '../controllers/tableSpecController.js'
import { verifyToken } from '../../common/middleware/authMiddleware.js'

const router = express.Router()

router.get('/', verifyToken, getTableList)
router.get('/:tablen', verifyToken, getTableDetail)
router.post('/', verifyToken, saveTableSpec)
router.post('/:tablen/generate-sql', verifyToken, generateSql)
router.get('/:tablen/sql/insert', verifyToken, generateInsertSql)
router.get('/:tablen/sql/update', verifyToken, generateUpdateSql)
router.post('/:tablen/execute-sql', verifyToken, executeSql)

export default router
