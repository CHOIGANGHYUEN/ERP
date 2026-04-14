import { sequelize, CodeHead, CodeItem } from '../models/index.js'
import { Op } from 'sequelize'

const codeService = {
  async getCodeHeads(params) {
    const { page = 1, size = 10, categoryCode, groupCode, description } = params
    const offset = (Number(page) - 1) * Number(size)

    const where = {}
    if (categoryCode) where.categoryCode = { [Op.like]: `%${categoryCode}%` }
    if (groupCode) where.groupCode = { [Op.like]: `%${groupCode}%` }
    if (description) where.description = { [Op.like]: `%${description}%` }

    const { rows, count } = await CodeHead.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(size),
      order: [['categoryCode', 'ASC'], ['groupCode', 'ASC']],
    })

    return {
      data: rows.map(r => r.toJSON()),
      total: count,
      page: Number(page),
      size: Number(size),
    }
  },

  async getCodeHeadDetail(categoryCode, groupCode) {
    const head = await CodeHead.findOne({
      where: { categoryCode, groupCode }
    })

    if (!head) {
      throw new Error('Code group not found')
    }

    const items = await CodeItem.findAll({
      where: { categoryCode, groupCode },
      order: [['subCode', 'ASC']]
    })

    return {
      headInfo: head.toJSON(),
      items: items.map(i => i.toJSON())
    }
  },

  async saveCodeGroup(data, user) {
    return await sequelize.transaction(async (t) => {
      const { headInfo, items = [] } = data
      const { categoryCode, groupCode } = headInfo

      // Save Head
      const existingHead = await CodeHead.findOne({ where: { categoryCode, groupCode }, transaction: t })
      
      if (existingHead) {
        await existingHead.update({
          ...headInfo,
          changedBy: user
        }, { transaction: t })
      } else {
        await CodeHead.create({
          ...headInfo,
          createdBy: user,
          changedBy: user
        }, { transaction: t })
      }

      // Save Items (Upsert logic)
      const existingItems = await CodeItem.findAll({ where: { categoryCode, groupCode }, transaction: t })
      const existingItemsMap = new Map(existingItems.map(i => [i.subCode, i]))

      for (const item of items) {
        const subCode = item.subCode
        if (existingItemsMap.has(subCode)) {
          await existingItemsMap.get(subCode).update({
            ...item,
            changedBy: user
          }, { transaction: t })
          existingItemsMap.delete(subCode)
        } else {
          await CodeItem.create({
            ...item,
            categoryCode,
            groupCode,
            createdBy: user,
            changedBy: user
          }, { transaction: t })
        }
      }

      // Delete items that were removed
      for (const [_subCode, oldItem] of existingItemsMap.entries()) {
        await oldItem.destroy({ transaction: t })
      }

      return { success: true }
    })
  },

  async deleteCodeGroup(categoryCode, groupCode) {
    return await sequelize.transaction(async (t) => {
      await CodeItem.destroy({ where: { categoryCode, groupCode }, transaction: t })
      await CodeHead.destroy({ where: { categoryCode, groupCode }, transaction: t })
      return { success: true }
    })
  }
}

export default codeService