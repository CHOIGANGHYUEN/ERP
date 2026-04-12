import { Plant } from '../models/index.js'
import { Op } from 'sequelize'

export default {
  async getList(query) {
    const page = parseInt(query.page) || 1
    const size = parseInt(query.size) || 10
    const offset = (page - 1) * size
    const where = {}

    if (query.company) where.company = { [Op.like]: `%${query.company}%` }
    if (query.plant) where.plant = { [Op.like]: `%${query.plant}%` }

    const { count, rows } = await Plant.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [['id', 'DESC']],
    })
    return { data: rows, total: count, page, size }
  },
  async getDetail(id) {
    if (id === 'new') return { useYn: 1 }
    const data = await Plant.findByPk(id)
    if (!data) throw new Error('정보를 찾을 수 없습니다.')
    return data
  },
  async save(data, user) {
    if (data.id) {
      const item = await Plant.findByPk(data.id)
      return await item.update({ ...data, changedBy: user })
    }
    return await Plant.create({ ...data, createdBy: user, changedBy: user })
  },
  async remove(id) {
    const item = await Plant.findByPk(id)
    await item.destroy()
    return { success: true }
  },
}
