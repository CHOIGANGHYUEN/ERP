import pool from '../../common/config/db.js'

const mockConfigs = [
  {
    configId: 'SYS_LANG',
    configName: 'System Language',
    configValue: 'ko',
    description: 'Default system language',
    useYn: 1,
  },
  {
    configId: 'PAGE_SIZE',
    configName: 'Default Page Size',
    configValue: '10',
    description: 'Default rows per page in tables',
    useYn: 1,
  },
  {
    configId: 'SESSION_TIMEOUT',
    configName: 'Session Timeout',
    configValue: '3600',
    description: 'Session timeout in seconds',
    useYn: 1,
  },
  {
    configId: 'THEME',
    configName: 'Default Theme',
    configValue: 'light',
    description: 'Default UI theme',
    useYn: 1,
  },
  {
    configId: 'MAX_LOGIN_ATTEMPT',
    configName: 'Max Login Attempts',
    configValue: '5',
    description: 'Maximum allowed login attempts before lock',
    useYn: 1,
  },
]

const configService = {
  async getAllConfigs(page = 1, limit = 10, search = '') {
    const connection = await pool.getConnection()
    try {
      const offset = (page - 1) * limit
      let query = 'SELECT * FROM sysConfig'
      const params = []

      if (search) {
        query += ' WHERE configId LIKE ? OR configName LIKE ?'
        params.push(`%${search}%`, `%${search}%`)
      }

      query += ' ORDER BY configId LIMIT ? OFFSET ?'
      params.push(parseInt(limit), parseInt(offset))

      const [rows] = await connection.query(query, params)

      let countQuery = 'SELECT COUNT(*) as total FROM sysConfig'
      const countParams = []
      if (search) {
        countQuery += ' WHERE configId LIKE ? OR configName LIKE ?'
        countParams.push(`%${search}%`, `%${search}%`)
      }
      const [countRows] = await connection.query(countQuery, countParams)

      if (rows.length === 0 && !search) {
        const start = parseInt(offset)
        const end = start + parseInt(limit)
        return {
          data: mockConfigs.slice(start, end),
          total: mockConfigs.length,
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
      console.error('Error fetching configs:', error)
      const start = (page - 1) * limit
      const end = start + limit
      return {
        data: mockConfigs.slice(start, end),
        total: mockConfigs.length,
        page: parseInt(page),
        limit: parseInt(limit),
      }
    } finally {
      connection.release()
    }
  },

  async getConfigById(configId) {
    const connection = await pool.getConnection()
    try {
      const [rows] = await connection.query('SELECT * FROM sysConfig WHERE configId = ?', [
        configId,
      ])
      if (rows.length === 0) {
        const mockConfig = mockConfigs.find((c) => c.configId === configId)
        if (mockConfig) return mockConfig
        throw new Error('Config not found')
      }
      return rows[0]
    } catch (error) {
      console.error('Error fetching config by ID:', error)
      const mockConfig = mockConfigs.find((c) => c.configId === configId)
      if (mockConfig) return mockConfig
      throw error
    } finally {
      connection.release()
    }
  },

  async createConfig(configData, userId) {
    const connection = await pool.getConnection()
    try {
      const now = new Date()
      const { configId, configName, configValue, description, useYn = 1 } = configData

      const query = `
        INSERT INTO sysConfig 
        (configId, configName, configValue, description, useYn, createdBy, createdAt, changedBy, changedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const params = [
        configId,
        configName,
        configValue,
        description,
        useYn,
        userId,
        now,
        userId,
        now,
      ]
      const [result] = await connection.query(query, params)
      return { id: result.insertId, ...configData }
    } catch (error) {
      console.error('Error creating config:', error)
      throw error
    } finally {
      connection.release()
    }
  },

  async updateConfig(configId, configData, userId) {
    const connection = await pool.getConnection()
    try {
      const now = new Date()
      const { configName, configValue, description, useYn } = configData

      const query = `
        UPDATE sysConfig 
        SET configName = ?, configValue = ?, description = ?, useYn = ?, changedBy = ?, changedAt = ?
        WHERE configId = ?
      `
      const params = [configName, configValue, description, useYn, userId, now, configId]
      const [result] = await connection.query(query, params)
      if (result.affectedRows === 0) {
        throw new Error('Config not found or no changes made')
      }
      return { configId, ...configData }
    } catch (error) {
      console.error('Error updating config:', error)
      throw error
    } finally {
      connection.release()
    }
  },

  async deleteConfig(configId) {
    const connection = await pool.getConnection()
    try {
      const [result] = await connection.query('DELETE FROM sysConfig WHERE configId = ?', [
        configId,
      ])
      if (result.affectedRows === 0) {
        throw new Error('Config not found')
      }
      return { message: 'Config deleted successfully' }
    } catch (error) {
      console.error('Error deleting config:', error)
      throw error
    } finally {
      connection.release()
    }
  },
}

export default configService
