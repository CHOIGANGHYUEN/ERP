import pool from '../../common/config/db.js'

const mockMenus = [
  {
    menuId: 'M001',
    menuNm: 'Dashboard',
    path: '/',
    menuLevel: 1,
    ordNum: 1,
    parentMenuId: null,
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M002',
    menuNm: 'System (SYS)',
    path: null,
    menuLevel: 1,
    ordNum: 2,
    parentMenuId: null,
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M003',
    menuNm: 'User Mgt',
    path: '/sys/SYST01',
    menuLevel: 2,
    ordNum: 1,
    parentMenuId: 'M002',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M004',
    menuNm: 'Role Mgt',
    path: '/sys/SYST02',
    menuLevel: 2,
    ordNum: 2,
    parentMenuId: 'M002',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M005',
    menuNm: 'Menu Mgt',
    path: '/sys/menus',
    menuLevel: 2,
    ordNum: 3,
    parentMenuId: 'M002',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M006',
    menuNm: 'Code Mgt',
    path: '/sys/SYST04',
    menuLevel: 2,
    ordNum: 4,
    parentMenuId: 'M002',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M007',
    menuNm: 'Settings',
    path: '/sys/SYST05',
    menuLevel: 2,
    ordNum: 5,
    parentMenuId: 'M002',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M008',
    menuNm: 'Table Specs',
    path: '/sys/tables',
    menuLevel: 2,
    ordNum: 6,
    parentMenuId: 'M002',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M009',
    menuNm: 'Financial (FI)',
    path: null,
    menuLevel: 1,
    ordNum: 3,
    parentMenuId: null,
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M010',
    menuNm: 'General Ledger',
    path: '/fi/gl',
    menuLevel: 2,
    ordNum: 1,
    parentMenuId: 'M009',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M011',
    menuNm: 'Human Resources (HR)',
    path: '/hr',
    menuLevel: 1,
    ordNum: 4,
    parentMenuId: null,
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M012',
    menuNm: 'Materials (MM)',
    path: null,
    menuLevel: 1,
    ordNum: 5,
    parentMenuId: null,
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M013',
    menuNm: 'Purchasing',
    path: null,
    menuLevel: 2,
    ordNum: 1,
    parentMenuId: 'M012',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M014',
    menuNm: 'Purchase Orders',
    path: '/mm/po',
    menuLevel: 3,
    ordNum: 1,
    parentMenuId: 'M013',
    langu: 'ko',
    useYn: 1,
  },
  {
    menuId: 'M015',
    menuNm: 'Sales (SD)',
    path: '/sd',
    menuLevel: 1,
    ordNum: 6,
    parentMenuId: null,
    langu: 'ko',
    useYn: 1,
  },
]

const menuService = {
  async getUserMenus(userId) {
    const connection = await pool.getConnection()
    try {
      const query = `
        SELECT DISTINCT m.menuId, m.menuNm, m.path, m.parentMenuId, m.menuLevel, m.ordNum
        FROM sysMenu m
        JOIN sysRoleMenu rm ON m.menuId = rm.menuId
        JOIN sysUserRole ur ON rm.roleId = ur.roleId
        WHERE ur.userId = ? 
          AND (m.useYn = 1 OR m.useYn IS NULL)
          AND (rm.useYn = 1 OR rm.useYn IS NULL)
          AND (ur.useYn = 1 OR ur.useYn IS NULL)
        ORDER BY m.menuLevel, m.ordNum
      `
      const [rows] = await connection.query(query, [userId])

      if (rows.length === 0) {
        return mockMenus
      }

      return rows
    } catch (error) {
      console.error('Error fetching user menus:', error)
      return mockMenus
    } finally {
      connection.release()
    }
  },

  async getAllMenus(page = 1, limit = 10, search = '') {
    const connection = await pool.getConnection()
    try {
      const offset = (page - 1) * limit
      let query = 'SELECT * FROM sysMenu'
      const params = []

      if (search) {
        query += ' WHERE menuId LIKE ? OR menuNm LIKE ?'
        params.push(`%${search}%`, `%${search}%`)
      }

      query += ' ORDER BY menuLevel, ordNum LIMIT ? OFFSET ?'
      params.push(parseInt(limit), parseInt(offset))

      const [rows] = await connection.query(query, params)

      let countQuery = 'SELECT COUNT(*) as total FROM sysMenu'
      const countParams = []
      if (search) {
        countQuery += ' WHERE menuId LIKE ? OR menuNm LIKE ?'
        countParams.push(`%${search}%`, `%${search}%`)
      }
      const [countRows] = await connection.query(countQuery, countParams)

      if (rows.length === 0 && !search) {
        const start = parseInt(offset)
        const end = start + parseInt(limit)
        return {
          data: mockMenus.slice(start, end),
          total: mockMenus.length,
          page: parseInt(page),
          limit: parseInt(limit),
        }
      }

      return {
        data: rows,
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
      }
    } catch (error) {
      console.error('Error fetching menus:', error)
      throw error
    } finally {
      connection.release()
    }
  },

  async getMenuById(menuId) {
    const connection = await pool.getConnection()
    try {
      const [rows] = await connection.query('SELECT * FROM sysMenu WHERE menuId = ?', [menuId])
      if (rows.length === 0) {
        const mockMenu = mockMenus.find((m) => m.menuId === menuId)
        if (mockMenu) return mockMenu
        throw new Error('Menu not found')
      }
      return rows[0]
    } catch (error) {
      console.error('Error fetching menu by ID:', error)
      throw error
    } finally {
      connection.release()
    }
  },

  async createMenu(menuData, userId) {
    const connection = await pool.getConnection()
    try {
      const now = new Date()
      const {
        langu = 'ko',
        menuId,
        menuLevel,
        ordNum,
        menuNm,
        description,
        parentMenuId,
        path,
        useYn = 1,
      } = menuData

      const query = `
        INSERT INTO sysMenu 
        (langu, menuId, menuLevel, ordNum, menuNm, description, parentMenuId, path, useYn, createdBy, createdAt, changedBy, changedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const params = [
        langu,
        menuId,
        menuLevel,
        ordNum,
        menuNm,
        description,
        parentMenuId || null,
        path,
        useYn,
        userId,
        now,
        userId,
        now,
      ]
      const [result] = await connection.query(query, params)
      return { id: result.insertId, ...menuData }
    } catch (error) {
      console.error('Error creating menu:', error)
      throw error
    } finally {
      connection.release()
    }
  },

  async updateMenu(menuId, menuData, userId) {
    const connection = await pool.getConnection()
    try {
      const now = new Date()
      const { langu, menuLevel, ordNum, menuNm, description, parentMenuId, path, useYn } = menuData

      const query = `
        UPDATE sysMenu 
        SET langu = ?, menuLevel = ?, ordNum = ?, menuNm = ?, description = ?, parentMenuId = ?, path = ?, useYn = ?, changedBy = ?, changedAt = ?
        WHERE menuId = ?
      `
      const params = [
        langu,
        menuLevel,
        ordNum,
        menuNm,
        description,
        parentMenuId || null,
        path,
        useYn,
        userId,
        now,
        menuId,
      ]
      const [result] = await connection.query(query, params)
      if (result.affectedRows === 0) {
        throw new Error('Menu not found or no changes made')
      }
      return { menuId, ...menuData }
    } catch (error) {
      console.error('Error updating menu:', error)
      throw error
    } finally {
      connection.release()
    }
  },

  async deleteMenu(menuId) {
    const connection = await pool.getConnection()
    try {
      const [result] = await connection.query('DELETE FROM sysMenu WHERE menuId = ?', [menuId])
      if (result.affectedRows === 0) {
        throw new Error('Menu not found')
      }
      return { message: 'Menu deleted successfully' }
    } catch (error) {
      console.error('Error deleting menu:', error)
      throw error
    } finally {
      connection.release()
    }
  },
}

export default menuService
