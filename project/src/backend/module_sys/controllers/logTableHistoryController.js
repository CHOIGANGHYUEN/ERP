import { TableHistory } from '../models/index.js'
import { Op } from 'sequelize'

const logTableHistoryController = {
  async getLogs(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1
      const size = parseInt(req.query.size, 10) || 20
      const offset = (page - 1) * size

      const { tablen, actionType } = req.query
      const where = {}

      if (tablen) {
        where.tablen = { [Op.like]: `%${tablen}%` }
      }
      if (actionType) {
        where.actionType = actionType
      }

      const { count, rows } = await TableHistory.findAndCountAll({
        where,
        limit: size,
        offset,
        order: [['createdAt', 'DESC']],
      })

      res.json({
        data: rows,
        total: count,
        page,
        size,
      })
    } catch (error) {
      console.error('Error fetching table history logs:', error)
      res.status(500).json({ message: 'Failed to fetch table history logs', error: error.message })
    }
  },
}

export default logTableHistoryController
