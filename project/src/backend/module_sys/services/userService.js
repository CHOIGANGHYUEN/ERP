import pool from '../../common/config/db.js'

const userService = {
  async findOrCreateUser(profile) {
    const { email, name, picture, googleId } = profile
    const connection = await pool.getConnection()
    try {
      // 1. Check if user exists by email (or userId)
      const [rows] = await connection.query('SELECT * FROM sysUser WHERE userId = ?', [email])

      if (rows.length > 0) {
        // User exists
        return rows[0]
      } else {
        // 2. Create new user
        const now = new Date()
        const [result] = await connection.query(
          'INSERT INTO sysUser (userId, createdBy, createdAt, changedBy, changedAt) VALUES (?, ?, ?, ?, ?)',
          [email, 'system', now, 'system', now],
        )

        const [newUserRows] = await connection.query('SELECT * FROM sysUser WHERE id = ?', [
          result.insertId,
        ])
        return newUserRows[0]
      }
    } catch (error) {
      console.error('Error in findOrCreateUser: ' + error.message)
      throw error
    } finally {
      connection.release()
    }
  },
}

export default userService
