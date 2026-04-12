import { LogUser } from '../models/index.js'
import { Op } from 'sequelize'

const logUserController = {
  async getLogs(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1
      const size = parseInt(req.query.size, 10) || 20
      const offset = (page - 1) * size

      const { userId, logDt } = req.query
      const where = {}

      if (userId) {
        where.userId = { [Op.like]: `%${userId}%` }
      }
      if (logDt) {
        where.logDt = logDt
      }

      const { count, rows } = await LogUser.findAndCountAll({
        where,
        limit: size,
        offset,
        order: [['logAt', 'DESC']],
      })

      res.json({
        data: rows,
        total: count,
        page,
        size,
      })
    } catch (error) {
      console.error('Error fetching user logs:', error)
      res.status(500).json({ message: 'Failed to fetch user logs', error: error.message })
    }
  },
}

export default logUserController
