import { Unit } from '../models/index.js'
import { Op } from 'sequelize'

export default {
  async getList(query) {
    const page = parseInt(query.page) || 1
    const size = parseInt(query.size) || 10
    const offset = (page - 1) * size
    const where = {}

    if (query.unit) where.unit = { [Op.like]: `%${query.unit}%` }
    if (query.unitNm) where.unitNm = { [Op.like]: `%${query.unitNm}%` }

    const { count, rows } = await Unit.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [
        ['dispOrd', 'ASC'],
        ['id', 'DESC'],
      ],
    })
    return { data: rows, total: count, page, size }
  },
  async getDetail(id) {
    if (id === 'new') return { useYn: '1', baseUnitYn: 1, dispOrd: 1, convRate: 1.0 }
    const data = await Unit.findByPk(id)
    if (!data) throw new Error('정보를 찾을 수 없습니다.')
    return data
  },
  async save(data, user) {
    if (data.id) {
      const item = await Unit.findByPk(data.id)
      return await item.update({ ...data, changedBy: user })
    }
    return await Unit.create({ ...data, createdBy: user, changedBy: user })
  },
  async remove(id) {
    const item = await Unit.findByPk(id)
    await item.destroy()
    return { success: true }
  },
}
