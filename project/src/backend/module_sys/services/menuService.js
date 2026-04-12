import { Menu, UserRole, RoleMenu } from '../models/index.js'
import { Op } from 'sequelize'

const mockMenus = [
  {
    menuId: 'SYS',
    menuNm: 'System',
    menuLevel: 1,
    ordNum: 1,
    path: '/sys',
    parentMenuId: '',
    useYn: 1,
  },
  {
    menuId: 'SYST00',
    menuNm: '시스템 바로가기',
    menuLevel: 2,
    ordNum: 1,
    path: '/sys/syst00',
    parentMenuId: 'SYS',
    useYn: 1,
  },
  {
    menuId: 'SYST01',
    menuNm: '사용자관리',
    menuLevel: 2,
    ordNum: 2,
    path: '/sys/syst01',
    parentMenuId: 'SYS',
    useYn: 1,
  },
  {
    menuId: 'SYST02',
    menuNm: '권한관리',
    menuLevel: 2,
    ordNum: 3,
    path: '/sys/syst02',
    parentMenuId: 'SYS',
    useYn: 1,
  },
  {
    menuId: 'SYST03',
    menuNm: '메뉴관리',
    menuLevel: 2,
    ordNum: 4,
    path: '/sys/syst03',
    parentMenuId: 'SYS',
    useYn: 1,
  },
  {
    menuId: 'SYST04',
    menuNm: '코드관리',
    menuLevel: 2,
    ordNum: 5,
    path: '/sys/syst04',
    parentMenuId: 'SYS',
    useYn: 1,
  },
  {
    menuId: 'SYST05',
    menuNm: '시스템설정',
    menuLevel: 2,
    ordNum: 6,
    path: '/sys/syst05',
    parentMenuId: 'SYS',
    useYn: 1,
  },
  {
    menuId: 'SYST06',
    menuNm: '테이블명세서',
    menuLevel: 2,
    ordNum: 7,
    path: '/sys/syst06',
    parentMenuId: 'SYS',
    useYn: 1,
  },
]

const menuService = {
  async getUserMenus(userId) {
    // 1. DB에 메뉴가 아예 없으면 Mock 데이터 반환 (초기 개발용)
    const totalMenus = await Menu.count()
    if (totalMenus === 0) {
      return mockMenus
    }

    // 2. 현재 로그인한 사용자의 권한(Role) 조회
    const userRoles = await UserRole.findAll({ where: { userId, useYn: 1 } })
    const roleIds = userRoles.map((ur) => ur.roleId)

    if (roleIds.length === 0) {
      // [안전장치] 시스템 전체에 권한 맵핑 데이터가 단 하나도 없다면 잠김 방지를 위해 전체 메뉴 반환
      const totalUserRoles = await UserRole.count()
      if (totalUserRoles === 0) {
        const allMenus = await Menu.findAll({
          where: { useYn: 1 },
          order: [
            ['menuLevel', 'ASC'],
            ['ordNum', 'ASC'],
          ],
        })
        return allMenus.map((m) => m.toJSON())
      }
      return []
    }

    // 3. 해당 권한들에 맵핑된 메뉴 ID 조회
    const roleMenus = await RoleMenu.findAll({
      where: { roleId: { [Op.in]: roleIds }, useYn: 1 },
    })
    const menuIds = [...new Set(roleMenus.map((rm) => rm.menuId))]

    if (menuIds.length === 0) return []

    // 4. 최종 접근 가능한 메뉴 목록 조회
    const menus = await Menu.findAll({
      where: { menuId: { [Op.in]: menuIds }, useYn: 1 },
      order: [
        ['menuLevel', 'ASC'],
        ['ordNum', 'ASC'],
      ],
    })

    return menus.map((m) => m.toJSON())
  },

  async getAllMenus(page = 1, limit = 100, search = '') {
    const offset = (page - 1) * limit

    const totalInDb = await Menu.count()
    if (totalInDb === 0) {
      let filteredMocks = mockMenus
      if (search) {
        const s = search.toLowerCase()
        filteredMocks = mockMenus.filter(
          (m) =>
            m.menuId.toLowerCase().includes(s) || (m.menuNm && m.menuNm.toLowerCase().includes(s)),
        )
      }
      return {
        data: filteredMocks.slice(offset, offset + limit),
        total: filteredMocks.length,
        page: parseInt(page),
        limit: parseInt(limit),
      }
    }

    const where = search
      ? {
          [Op.or]: [
            { menuId: { [Op.like]: `%${search}%` } },
            { menuNm: { [Op.like]: `%${search}%` } },
          ],
        }
      : {}

    const { rows, count } = await Menu.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [
        ['menuLevel', 'ASC'],
        ['ordNum', 'ASC'],
      ],
    })

    return {
      data: rows.map((r) => r.toJSON()),
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    }
  },

  async getMenuById(menuId) {
    const menu = await Menu.findOne({ where: { menuId } })
    if (!menu) throw new Error('Menu not found')
    return menu.toJSON()
  },

  async createMenu(menuData, userId) {
    const { menuId, langu = 'KO' } = menuData
    const existingMenu = await Menu.findOne({ where: { menuId, langu } })

    if (existingMenu) {
      throw new Error(`Menu ID '${menuId}' already exists.`)
    }

    const newMenu = await Menu.create({
      ...menuData,
      createdBy: userId,
      changedBy: userId,
    })
    return newMenu.toJSON()
  },

  async updateMenu(menuId, menuData, userId) {
    const [updatedRows] = await Menu.update(
      {
        ...menuData,
        changedBy: userId,
      },
      { where: { menuId } },
    )

    if (updatedRows === 0) {
      throw new Error('Menu not found or no changes made')
    }
    return { menuId, ...menuData, changedBy: userId }
  },

  async deleteMenu(menuId) {
    const deletedRows = await Menu.destroy({ where: { menuId } })
    if (deletedRows === 0) {
      throw new Error('Menu not found')
    }
    return { message: 'Menu deleted successfully' }
  },
}

export default menuService
