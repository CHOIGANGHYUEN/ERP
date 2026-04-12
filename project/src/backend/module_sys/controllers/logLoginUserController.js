import { LogLoginUser } from '../models/index.js'
import { Op } from 'sequelize'

const logLoginUserController = {
  async getLogs(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1
      const size = parseInt(req.query.size, 10) || 20
      const offset = (page - 1) * size

      const { userId, loginDt } = req.query
      const where = {}

      if (userId) {
        where.userId = { [Op.like]: `%${userId}%` }
      }
      if (loginDt) {
        where.loginDt = loginDt
      }

      const { count, rows } = await LogLoginUser.findAndCountAll({
        where,
        limit: size,
        offset,
        order: [['loginAt', 'DESC']],
      })

      res.json({
        data: rows,
        total: count,
        page,
        size,
      })
    } catch (error) {
      console.error('Error fetching login logs:', error)
      res.status(500).json({ message: 'Failed to fetch login logs', error: error.message })
    }
  },
}

export default logLoginUserController
