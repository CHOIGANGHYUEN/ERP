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
    // Basic user id retrieval (assume it is added to req by some auth middleware)
    const user = req.user?.id || 'system'
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
