import { User } from '../models/index.js'
import { Op } from 'sequelize'

const userService = {
  async getUsers(query) {
    const page = parseInt(query.page, 10) || 1
    const size = parseInt(query.size, 10) || 10
    const search = query.search || ''

    const offset = (page - 1) * size
    const where = {}

    if (search) {
      where.userId = { [Op.like]: `%${search}%` }
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [['createdAt', 'DESC']],
    })

    return {
      data: rows,
      total: count,
      page,
      size,
    }
  },

  async getUserDetail(id) {
    const user = await User.findByPk(id)
    if (!user) throw new Error('해당 사용자를 찾을 수 없습니다.')
    return user
  },

  async saveUser(data, actor) {
    // 신규 등록 또는 ID 변경 시 중복 검사
    if (data.userId) {
      const existingUser = await User.findOne({ where: { userId: data.userId } })
      if (existingUser && existingUser.id !== Number(data.id)) {
        throw new Error('이미 사용 중인 사용자 ID입니다.')
      }
    }

    if (data.id) {
      const user = await User.findByPk(data.id)
      if (!user) throw new Error('사용자를 찾을 수 없습니다.')

      await user.update({
        userId: data.userId,
        changedBy: actor,
      })
      return user
    } else {
      const user = await User.create({
        userId: data.userId,
        createdBy: actor,
        changedBy: actor,
      })
      return user
    }
  },

  async deleteUser(id) {
    const user = await User.findByPk(id)
    if (!user) throw new Error('사용자를 찾을 수 없습니다.')

    await user.destroy()
    return { success: true }
  },

  // Google 로그인 연동용 (authController.js 에서 호출됨)
  async findOrCreateUser({ email }) {
    let user = await User.findOne({ where: { userId: email } })
    if (!user) {
      user = await User.create({
        userId: email,
        createdBy: 'system',
        changedBy: 'system',
      })
    }
    return user
  },
}

export default userService
