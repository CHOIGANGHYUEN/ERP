import { sequelize, Role, RoleMenu, UserRole } from '../models/index.js'
import { Op } from 'sequelize'

const mockRoles = [
  {
    roleId: 'SUPER_ADMIN',
    description: 'System-wide full access administrator',
    useYn: 1,
  },
  {
    roleId: 'SYS_ADMIN',
    description: 'Administrator for system settings and master data',
    useYn: 1,
  },
  {
    roleId: 'HR_MANAGER',
    description: 'Human Resources department manager',
    useYn: 1,
  },
  {
    roleId: 'FI_USER',
    description: 'General user for finance and accounting',
    useYn: 1,
  },
  {
    roleId: 'USER',
    description: 'Default user role with minimal access',
    useYn: 1,
  },
]

const roleService = {
  async getAllRoles(page = 1, limit = 10, search = '') {
    try {
      const offset = (page - 1) * limit

      const totalInDb = await Role.count()

      if (totalInDb === 0) {
        let filteredMocks = mockRoles
        if (search) {
          const s = search.toLowerCase()
          filteredMocks = mockRoles.filter(
            (r) =>
              r.roleId.toLowerCase().includes(s) ||
              (r.description && r.description.toLowerCase().includes(s)),
          )
        }
        const start = parseInt(offset)
        const end = start + parseInt(limit)
        return {
          data: filteredMocks.slice(start, end),
          total: filteredMocks.length,
          page: parseInt(page),
          limit: parseInt(limit),
        }
      }

      const where = search
        ? {
            [Op.or]: [
              { roleId: { [Op.like]: `%${search}%` } },
              { description: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}

      const { rows, count } = await Role.findAndCountAll({
        where,
        offset: parseInt(offset),
        limit: parseInt(limit),
        order: [['roleId', 'ASC']],
      })

      return {
        data: rows.map((r) => r.toJSON()),
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
      throw error
    }
  },

  async getRoleById(roleId) {
    const role = await Role.findOne({ where: { roleId } })
    if (!role) {
      const mockRole = mockRoles.find((r) => r.roleId === roleId)
      if (mockRole) return mockRole
      throw new Error('Role not found')
    }
    return role.toJSON()
  },

  async createRole(roleData, userId) {
    const { roleId, description, useYn = 1 } = roleData

    const existingRole = await Role.findOne({ where: { roleId } })
    if (existingRole) {
      throw new Error(`Role ID '${roleId}' already exists.`)
    }

    await Role.create({
      roleId,
      description,
      useYn,
      createdBy: userId,
      changedBy: userId,
    })

    return { roleId, description, useYn, createdBy: userId, createdAt: now }
  },

  async updateRole(roleId, roleData, userId) {
    const { description, useYn } = roleData

    const [updatedRows] = await Role.update(
      {
        description,
        useYn,
        changedBy: userId,
      },
      { where: { roleId } },
    )

    if (updatedRows === 0) {
      throw new Error('Role not found or no changes made')
    }
    return { roleId, ...roleData, changedBy: userId }
  },

  async deleteRole(roleId) {
    const deletedRows = await Role.destroy({ where: { roleId } })
    if (deletedRows === 0) {
      throw new Error('Role not found')
    }
    return { message: 'Role deleted successfully' }
  },

  async getRoleMenus(roleId) {
    const rows = await RoleMenu.findAll({ where: { roleId, useYn: 1 } })
    return rows.map((r) => r.menuId)
  },

  async updateRoleMenus(roleId, menuIds, userId) {
    await sequelize.transaction(async (t) => {
      await RoleMenu.destroy({ where: { roleId }, transaction: t })
      if (menuIds && menuIds.length > 0) {
        const records = menuIds.map((menuId) => ({
          roleId,
          menuId,
          useYn: 1,
          createdBy: userId,
          changedBy: userId,
        }))
        await RoleMenu.bulkCreate(records, { transaction: t })
      }
    })
    return { success: true }
  },

  async getRoleUsers(roleId) {
    const rows = await UserRole.findAll({ where: { roleId, useYn: 1 } })
    return rows.map((r) => r.userId)
  },

  async updateRoleUsers(roleId, userIds, userId) {
    await sequelize.transaction(async (t) => {
      await UserRole.destroy({ where: { roleId }, transaction: t })
      if (userIds && userIds.length > 0) {
        const records = userIds.map((uid) => ({
          userId: uid,
          roleId,
          useYn: 1,
          createdBy: userId,
          changedBy: userId,
        }))
        await UserRole.bulkCreate(records, { transaction: t })
      }
    })
    return { success: true }
  },
}

export default roleService
