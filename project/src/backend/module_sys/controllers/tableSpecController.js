import tableSpecService from '../services/tableSpecService.js'

export const getTableList = async (req, res) => {
  try {
    const rows = await tableSpecService.getList(req.query)
    res.json(rows)
  } catch (error) {
    console.error('Error in getTableList:', error)
    res.status(500).json({ error: error.message })
  }
}

export const getTableDetail = async (req, res) => {
  try {
    const { tablen } = req.params
    const langu = req.query.langu || 'KO'
    const detail = await tableSpecService.getDetail(tablen, langu)
    if (!detail) {
      return res.status(404).json({ error: 'Table not found' })
    }
    res.json(detail)
  } catch (error) {
    console.error('Error in getTableDetail:', error)
    res.status(500).json({ error: error.message })
  }
}

export const saveTableSpec = async (req, res) => {
  try {
    // 토큰에서 추출된 실제 접속 사용자 ID (userId) 확보
    const user = req.user?.userId || 'system'
    const result = await tableSpecService.saveSpec(req.body, user)
    res.json(result)
  } catch (error) {
    console.error('Error in saveTableSpec:', error)
    res.status(500).json({ error: error.message })
  }
}

export const generateSql = async (req, res) => {
  try {
    const { tablen } = req.params
    const sql = await tableSpecService.generateSql(tablen)
    res.json({ sql })
  } catch (error) {
    console.error('Error in generateSql:', error)
    res.status(500).json({ error: error.message })
  }
}

export const generateInsertSql = async (req, res) => {
  try {
    const { tablen } = req.params
    const sql = await tableSpecService.generateInsertSql(tablen)
    res.json({ sql })
  } catch (error) {
    console.error('Error in generateInsertSql:', error)
    res.status(500).json({ error: error.message })
  }
}

export const generateUpdateSql = async (req, res) => {
  try {
    const { tablen } = req.params
    const sql = await tableSpecService.generateUpdateSql(tablen)
    res.json({ sql })
  } catch (error) {
    console.error('Error in generateUpdateSql:', error)
    res.status(500).json({ error: error.message })
  }
}

export const executeSql = async (req, res) => {
  try {
    const { tablen } = req.params
    const { sql } = req.body
    const result = await tableSpecService.executeRawSql(tablen, sql)
    res.json(result)
  } catch (error) {
    console.error('Error in executeSql:', error)
    res.status(500).json({ error: error.message })
  }
}
