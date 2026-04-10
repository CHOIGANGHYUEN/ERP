import pool from '../../common/config/db.js'

const roleRepository = {
  async findRoles(offset, limit, search) {
    let query = 'SELECT * FROM sysRole'
    const params = []
    if (search) {
      query += ' WHERE roleId LIKE ? OR description LIKE ?'
      params.push(`%${search}%`, `%${search}%`)
    }
    query += ' ORDER BY roleId LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const [rows] = await pool.query(query, params)
    return rows
  },

  async countRoles(search) {
    let query = 'SELECT COUNT(*) as total FROM sysRole'
    const params = []
    if (search) {
      query += ' WHERE roleId LIKE ? OR description LIKE ?'
      params.push(`%${search}%`, `%${search}%`)
    }
    const [rows] = await pool.query(query, params)
    return rows[0].total
  },

  async findRoleById(roleId) {
    const [rows] = await pool.query('SELECT * FROM sysRole WHERE roleId = ?', [roleId])
    return rows[0] || null
  },

  async createRole(roleData) {
    const { roleId, description, useYn, createdBy, createdAt, changedBy, changedAt } = roleData
    const query = `
      INSERT INTO sysRole 
      (roleId, description, useYn, createdBy, createdAt, changedBy, changedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    const params = [roleId, description, useYn, createdBy, createdAt, changedBy, changedAt]
    const [result] = await pool.query(query, params)
    return result
  },

  async updateRole(roleId, roleData) {
    const { description, useYn, changedBy, changedAt } = roleData
    const query = `
      UPDATE sysRole 
      SET description = ?, useYn = ?, changedBy = ?, changedAt = ?
      WHERE roleId = ?
    `
    const params = [description, useYn, changedBy, changedAt, roleId]
    const [result] = await pool.query(query, params)
    return result
  },

  async deleteRole(roleId) {
    const [result] = await pool.query('DELETE FROM sysRole WHERE roleId = ?', [roleId])
    return result
  },

  async findRoleMenus(roleId) {
    const [rows] = await pool.query(
      'SELECT menuId FROM sysRoleMenu WHERE roleId = ? AND useYn = 1',
      [roleId],
    )
    return rows
  },

  async updateRoleMenusTx(roleId, menuIds, userId, now) {
    const connection = await pool.getConnection()
    await connection.beginTransaction()
    try {
      await connection.query('DELETE FROM sysRoleMenu WHERE roleId = ?', [roleId])
      if (menuIds && menuIds.length > 0) {
        const values = menuIds.map((menuId) => [roleId, menuId, 1, userId, now, userId, now])
        await connection.query(
          'INSERT INTO sysRoleMenu (roleId, menuId, useYn, createdBy, createdAt, changedBy, changedAt) VALUES ?',
          [values],
        )
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },

  async findRoleUsers(roleId) {
    const [rows] = await pool.query(
      'SELECT userId FROM sysUserRole WHERE roleId = ? AND useYn = 1',
      [roleId],
    )
    return rows
  },

  async updateRoleUsersTx(roleId, userIds, userId, now) {
    const connection = await pool.getConnection()
    await connection.beginTransaction()
    try {
      await connection.query('DELETE FROM sysUserRole WHERE roleId = ?', [roleId])
      if (userIds && userIds.length > 0) {
        const values = userIds.map((uid) => [uid, roleId, 1, userId, now, userId, now])
        await connection.query(
          'INSERT INTO sysUserRole (userId, roleId, useYn, createdBy, createdAt, changedBy, changedAt) VALUES ?',
          [values],
        )
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },
}

export default roleRepository
