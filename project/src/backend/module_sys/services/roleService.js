import roleRepository from '../repositories/roleRepository.js'

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

      // DB에 전체 데이터가 있는지 확인 (Mock fallback 용도)
      const totalInDb = await roleRepository.countRoles('')

      if (totalInDb === 0) {
        // DB가 비어있으면 검색어 포함하여 Mock 데이터 필터링 후 반환
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

      // DB 조회 수행
      const rows = await roleRepository.findRoles(offset, limit, search)
      const total = await roleRepository.countRoles(search)

      return {
        data: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
      throw error
    }
  },

  async getRoleById(roleId) {
    const role = await roleRepository.findRoleById(roleId)
    if (!role) {
      const mockRole = mockRoles.find((r) => r.roleId === roleId)
      if (mockRole) return mockRole
      throw new Error('Role not found')
    }
    return role
  },

  async createRole(roleData, userId) {
    const { roleId, description, useYn = 1 } = roleData

    // 1. Role ID 중복 체크 (비즈니스 로직)
    const existingRole = await roleRepository.findRoleById(roleId)
    if (existingRole) {
      throw new Error(`Role ID '${roleId}' already exists.`)
    }

    // 2. 신규 생성
    const now = new Date()
    await roleRepository.createRole({
      roleId,
      description,
      useYn,
      createdBy: userId,
      createdAt: now,
      changedBy: userId,
      changedAt: now,
    })

    return { roleId, description, useYn, createdBy: userId, createdAt: now }
  },

  async updateRole(roleId, roleData, userId) {
    const { description, useYn } = roleData
    const now = new Date()

    const result = await roleRepository.updateRole(roleId, {
      description,
      useYn,
      changedBy: userId,
      changedAt: now,
    })

    if (result.affectedRows === 0) {
      throw new Error('Role not found or no changes made')
    }
    return { roleId, ...roleData, changedBy: userId, changedAt: now }
  },

  async deleteRole(roleId) {
    const result = await roleRepository.deleteRole(roleId)
    if (result.affectedRows === 0) {
      throw new Error('Role not found')
    }
    return { message: 'Role deleted successfully' }
  },

  async getRoleMenus(roleId) {
    const rows = await roleRepository.findRoleMenus(roleId)
    return rows.map((r) => r.menuId)
  },

  async updateRoleMenus(roleId, menuIds, userId) {
    const now = new Date()
    await roleRepository.updateRoleMenusTx(roleId, menuIds, userId, now)
    return { success: true }
  },

  async getRoleUsers(roleId) {
    const rows = await roleRepository.findRoleUsers(roleId)
    return rows.map((r) => r.userId)
  },

  async updateRoleUsers(roleId, userIds, userId) {
    const now = new Date()
    await roleRepository.updateRoleUsersTx(roleId, userIds, userId, now)
    return { success: true }
  },
}

export default roleService
