import pool from '../../common/config/db.js'

const tableSpecService = {
  async getList(params) {
    const { langu = 'KO', module, tablen, tableNm, page = 1, size = 20 } = params
    const connection = await pool.getConnection()
    try {
      const offset = (Number(page) - 1) * Number(size)
      let query = `
        SELECT t.id, t.tablen, t.module, x.tableNm, x.description, t.createdAt 
        FROM sysTable t 
        LEFT JOIN sysTablex x ON t.tablen = x.tablen AND x.langu = ? 
        WHERE 1=1
      `
      const queryParams = [langu]

      if (module) {
        query += ' AND t.module = ?'
        queryParams.push(module)
      }
      if (tablen) {
        query += ' AND t.tablen LIKE ?'
        queryParams.push(`%${tablen}%`)
      }
      if (tableNm) {
        query += ' AND x.tableNm LIKE ?'
        queryParams.push(`%${tableNm}%`)
      }

      query += ' ORDER BY t.tablen ASC LIMIT ? OFFSET ?'
      queryParams.push(Number(size), Number(offset))

      const [rows] = await connection.query(query, queryParams)

      let countQuery = `SELECT COUNT(*) as total FROM sysTable t LEFT JOIN sysTablex x ON t.tablen = x.tablen AND x.langu = ? WHERE 1=1`
      const countParams = [langu]
      if (module) {
        countQuery += ' AND t.module = ?'
        countParams.push(module)
      }
      if (tablen) {
        countQuery += ' AND t.tablen LIKE ?'
        countParams.push(`%${tablen}%`)
      }
      if (tableNm) {
        countQuery += ' AND x.tableNm LIKE ?'
        countParams.push(`%${tableNm}%`)
      }

      const [countRows] = await connection.query(countQuery, countParams)

      return { data: rows, total: countRows[0].total, page: Number(page), size: Number(size) }
    } finally {
      connection.release()
    }
  },

  async getDetail(tablen, langu = 'KO') {
    const connection = await pool.getConnection()
    try {
      const [tableRes] = await connection.query(
        'SELECT t.*, x.tableNm, x.description FROM sysTable t LEFT JOIN sysTablex x ON t.tablen = x.tablen AND x.langu = ? WHERE t.tablen = ?',
        [langu, tablen],
      )

      if (tableRes.length === 0) {
        // 신규 생성을 위한 빈 템플릿 반환
        return {
          tableInfo: { tablen, module: 'SYS', tableNm: '', description: '' },
          fields: [],
          indexes: [],
          history: [],
        }
      }

      const [fields] = await connection.query(
        'SELECT f.*, x.fieldNm, x.description FROM sysFields f LEFT JOIN sysFieldsx x ON f.tablen = x.tablen AND f.fieldn = x.fieldn AND x.langu = ? WHERE f.tablen = ? ORDER BY f.fieldOrder ASC',
        [langu, tablen],
      )
      const [indexes] = await connection.query(
        'SELECT i.*, x.indexNm, x.description FROM sysTableIndex i LEFT JOIN sysTableIndexx x ON i.tablen = x.tablen AND i.indexn = x.indexn AND x.langu = ? WHERE i.tablen = ?',
        [langu, tablen],
      )

      for (let idx of indexes) {
        const [idxFields] = await connection.query(
          'SELECT * FROM sysIndexFields WHERE tablen = ? AND indexn = ? ORDER BY fieldOrder ASC',
          [tablen, idx.indexn],
        )
        idx.indexFields = idxFields
      }

      const [history] = await connection.query(
        'SELECT * FROM sysTableHistory WHERE tablen = ? ORDER BY id DESC',
        [tablen],
      )

      return {
        tableInfo: tableRes[0],
        fields,
        indexes,
        history,
      }
    } finally {
      connection.release()
    }
  },

  async saveSpec(data, user) {
    const connection = await pool.getConnection()
    await connection.beginTransaction()
    try {
      const tableInfo = data.tableInfo || data
      const { tablen, module = 'SYS', langu = 'KO', tableNm = '', description = '' } = tableInfo
      const fields = data.fields || []
      const indexes = data.indexes || []
      const now = new Date()

      const [oldTable] = await connection.query('SELECT * FROM sysTable WHERE tablen = ?', [tablen])
      const [oldTablex] = await connection.query(
        'SELECT * FROM sysTablex WHERE tablen = ? AND langu = ?',
        [tablen, langu],
      )
      const [oldFields] = await connection.query(
        'SELECT f.*, fx.fieldNm, fx.description FROM sysFields f LEFT JOIN sysFieldsx fx ON f.tablen=fx.tablen AND f.fieldn=fx.fieldn AND fx.langu=? WHERE f.tablen = ?',
        [langu, tablen],
      )
      const [oldIndexes] = await connection.query(
        'SELECT i.*, ix.indexNm, ix.description FROM sysTableIndex i LEFT JOIN sysTableIndexx ix ON i.tablen=ix.tablen AND i.indexn=ix.indexn AND ix.langu=? WHERE i.tablen = ?',
        [langu, tablen],
      )

      const logHistory = async (actionType, targetType, targetName, oldV, newV) => {
        await connection.query(
          'INSERT INTO sysTableHistory (tablen, actionType, targetType, targetName, beforeValue, afterValue, isApplied, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
          [
            tablen,
            actionType,
            targetType,
            targetName,
            JSON.stringify(oldV),
            JSON.stringify(newV),
            now,
            user,
          ],
        )
      }

      if (oldTable.length === 0) {
        await connection.query(
          'INSERT INTO sysTable (tablen, module, createdAt, createdBy) VALUES (?, ?, ?, ?)',
          [tablen, module, now, user],
        )
        await connection.query(
          'INSERT INTO sysTablex (tablen, langu, module, tableNm, description) VALUES (?, ?, ?, ?, ?)',
          [tablen, langu, module, tableNm, description],
        )
        await logHistory('INSERT', 'TABLE', tablen, null, { tablen, module, tableNm, description })
      } else {
        const oldTableNm = oldTablex.length > 0 ? oldTablex[0].tableNm : null
        const oldDescr = oldTablex.length > 0 ? oldTablex[0].description : null
        if (oldTableNm !== tableNm || oldDescr !== description) {
          await connection.query(
            'INSERT INTO sysTablex (tablen, langu, module, tableNm, description) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE tableNm = ?, description = ?',
            [tablen, langu, module, tableNm, description, tableNm, description],
          )
          await logHistory(
            'UPDATE',
            'TABLE',
            tablen,
            { tableNm: oldTableNm, description: oldDescr },
            { tableNm, description },
          )
        }
      }

      const oldFieldsMap = Object.fromEntries(oldFields.map((f) => [f.fieldn, f]))
      for (const f of fields) {
        if (!oldFieldsMap[f.fieldn]) {
          await connection.query(
            'INSERT INTO sysFields (tablen, fieldn, module, fieldType, fieldLength, fieldKey, isNull, fieldOrder, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              tablen,
              f.fieldn,
              module,
              f.fieldType,
              f.fieldLength || null,
              f.fieldKey || '',
              f.isNull || 0,
              f.fieldOrder || 0,
              now,
              user,
            ],
          )
          await connection.query(
            'INSERT INTO sysFieldsx (tablen, fieldn, langu, module, fieldNm, description) VALUES (?, ?, ?, ?, ?, ?)',
            [tablen, f.fieldn, langu, module, f.fieldNm || '', f.description || ''],
          )
          await logHistory('INSERT', 'FIELD', f.fieldn, null, f)
        } else {
          const old = oldFieldsMap[f.fieldn]
          const isDiff =
            old.fieldType !== f.fieldType ||
            old.fieldLength !== f.fieldLength ||
            old.fieldKey !== f.fieldKey ||
            old.isNull !== f.isNull ||
            old.fieldOrder !== f.fieldOrder ||
            old.fieldNm !== f.fieldNm ||
            old.description !== f.description
          if (isDiff) {
            await connection.query(
              'UPDATE sysFields SET fieldType=?, fieldLength=?, fieldKey=?, isNull=?, fieldOrder=?, changedAt=?, changedBy=? WHERE tablen=? AND fieldn=?',
              [
                f.fieldType,
                f.fieldLength || null,
                f.fieldKey || '',
                f.isNull || 0,
                f.fieldOrder || 0,
                now,
                user,
                tablen,
                f.fieldn,
              ],
            )
            await connection.query(
              'INSERT INTO sysFieldsx (tablen, fieldn, langu, module, fieldNm, description) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE fieldNm = ?, description = ?',
              [
                tablen,
                f.fieldn,
                langu,
                module,
                f.fieldNm || '',
                f.description || '',
                f.fieldNm || '',
                f.description || '',
              ],
            )
            await logHistory('UPDATE', 'FIELD', f.fieldn, old, f)
          }
          delete oldFieldsMap[f.fieldn]
        }
      }
      for (const [fieldn, oldF] of Object.entries(oldFieldsMap)) {
        await connection.query('DELETE FROM sysFieldsx WHERE tablen=? AND fieldn=?', [
          tablen,
          fieldn,
        ])
        await connection.query('DELETE FROM sysFields WHERE tablen=? AND fieldn=?', [
          tablen,
          fieldn,
        ])
        await logHistory('DELETE', 'FIELD', fieldn, oldF, null)
      }

      const oldIndexesMap = Object.fromEntries(oldIndexes.map((i) => [i.indexn, i]))
      for (const i of indexes) {
        if (!oldIndexesMap[i.indexn]) {
          await connection.query(
            'INSERT INTO sysTableIndex (tablen, indexn, module, isUnique, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?)',
            [tablen, i.indexn, module, i.isUnique || 0, now, user],
          )
          await connection.query(
            'INSERT INTO sysTableIndexx (tablen, indexn, langu, module, indexNm, description) VALUES (?, ?, ?, ?, ?, ?)',
            [tablen, i.indexn, langu, module, i.indexNm || '', i.description || ''],
          )

          for (const inf of i.indexFields || []) {
            await connection.query(
              'INSERT INTO sysIndexFields (tablen, indexn, fieldn, module, fieldOrder) VALUES (?, ?, ?, ?, ?)',
              [tablen, i.indexn, inf.fieldn, module, inf.fieldOrder || 0],
            )
          }
          await logHistory('INSERT', 'INDEX', i.indexn, null, i)
        } else {
          const old = oldIndexesMap[i.indexn]
          if (
            old.isUnique !== i.isUnique ||
            old.indexNm !== i.indexNm ||
            old.description !== i.description
          ) {
            await connection.query(
              'UPDATE sysTableIndex SET isUnique=?, changedAt=?, changedBy=? WHERE tablen=? AND indexn=?',
              [i.isUnique || 0, now, user, tablen, i.indexn],
            )
            await connection.query(
              'INSERT INTO sysTableIndexx (tablen, indexn, langu, module, indexNm, description) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE indexNm=?, description=?',
              [
                tablen,
                i.indexn,
                langu,
                module,
                i.indexNm || '',
                i.description || '',
                i.indexNm || '',
                i.description || '',
              ],
            )
            await logHistory('UPDATE', 'INDEX', i.indexn, old, i)
          }
          await connection.query('DELETE FROM sysIndexFields WHERE tablen=? AND indexn=?', [
            tablen,
            i.indexn,
          ])
          for (const inf of i.indexFields || []) {
            await connection.query(
              'INSERT INTO sysIndexFields (tablen, indexn, fieldn, module, fieldOrder) VALUES (?, ?, ?, ?, ?)',
              [tablen, i.indexn, inf.fieldn, module, inf.fieldOrder || 0],
            )
          }
          delete oldIndexesMap[i.indexn]
        }
      }
      for (const [indexn, oldI] of Object.entries(oldIndexesMap)) {
        await connection.query('DELETE FROM sysIndexFields WHERE tablen=? AND indexn=?', [
          tablen,
          indexn,
        ])
        await connection.query('DELETE FROM sysTableIndexx WHERE tablen=? AND indexn=?', [
          tablen,
          indexn,
        ])
        await connection.query('DELETE FROM sysTableIndex WHERE tablen=? AND indexn=?', [
          tablen,
          indexn,
        ])
        await logHistory('DELETE', 'INDEX', indexn, oldI, null)
      }

      await connection.commit()
      return { success: true }
    } catch (e) {
      await connection.rollback()
      throw e
    } finally {
      connection.release()
    }
  },

  async generateSql(tablen) {
    const connection = await pool.getConnection()
    try {
      const [histories] = await connection.query(
        'SELECT * FROM sysTableHistory WHERE tablen = ? AND isApplied = 0 ORDER BY id ASC',
        [tablen],
      )

      if (histories.length === 0) {
        return '/* No pending changes to apply */'
      }

      let sqlStatements = []
      let isCreateTable = histories.some(
        (h) => h.targetType === 'TABLE' && h.actionType === 'INSERT',
      )

      if (isCreateTable) {
        const [fieldRows] = await connection.query(
          'SELECT * FROM sysFields WHERE tablen = ? ORDER BY fieldOrder ASC',
          [tablen],
        )
        const [indexRows] = await connection.query('SELECT * FROM sysTableIndex WHERE tablen = ?', [
          tablen,
        ])

        let createSql = `CREATE TABLE ${tablen} (\n`
        let fieldSqls = []
        let pks = []
        for (const f of fieldRows) {
          let fSql = `  ${f.fieldn} ${f.fieldType}${f.fieldLength ? '(' + f.fieldLength + ')' : ''} ${f.isNull ? '' : 'NOT NULL'}`
          fieldSqls.push(fSql)
          if (f.fieldKey === 'PRI') pks.push(f.fieldn)
        }
        if (pks.length > 0) {
          fieldSqls.push(`  PRIMARY KEY (${pks.join(', ')})`)
        }
        createSql += fieldSqls.join(',\n') + '\n);'
        sqlStatements.push(createSql)

        for (const idx of indexRows) {
          const [idxFields] = await connection.query(
            'SELECT * FROM sysIndexFields WHERE tablen = ? AND indexn = ? ORDER BY fieldOrder ASC',
            [tablen, idx.indexn],
          )
          const fnames = idxFields.map((inf) => inf.fieldn).join(', ')
          let idxSql = `CREATE ${idx.isUnique ? 'UNIQUE ' : ''}INDEX ${idx.indexn} ON ${tablen} (${fnames});`
          sqlStatements.push(idxSql)
        }
      } else {
        for (const h of histories) {
          if (h.targetType === 'FIELD') {
            const newV = JSON.parse(h.afterValue || '{}') || {}
            if (h.actionType === 'INSERT') {
              sqlStatements.push(
                `ALTER TABLE ${tablen} ADD COLUMN ${h.targetName} ${newV.fieldType}${newV.fieldLength ? '(' + newV.fieldLength + ')' : ''} ${newV.isNull ? '' : 'NOT NULL'};`,
              )
            } else if (h.actionType === 'UPDATE') {
              sqlStatements.push(
                `ALTER TABLE ${tablen} MODIFY COLUMN ${h.targetName} ${newV.fieldType}${newV.fieldLength ? '(' + newV.fieldLength + ')' : ''} ${newV.isNull ? '' : 'NOT NULL'};`,
              )
            } else if (h.actionType === 'DELETE') {
              sqlStatements.push(`ALTER TABLE ${tablen} DROP COLUMN ${h.targetName};`)
            }
          } else if (h.targetType === 'INDEX') {
            if (h.actionType === 'INSERT') {
              const newV = JSON.parse(h.afterValue || '{}') || {}
              const [idxFields] = await connection.query(
                'SELECT * FROM sysIndexFields WHERE tablen = ? AND indexn = ? ORDER BY fieldOrder ASC',
                [tablen, h.targetName],
              )
              const fnames = idxFields.map((inf) => inf.fieldn).join(', ')
              sqlStatements.push(
                `CREATE ${newV.isUnique ? 'UNIQUE ' : ''}INDEX ${h.targetName} ON ${tablen} (${fnames});`,
              )
            } else if (h.actionType === 'DELETE') {
              sqlStatements.push(`DROP INDEX ${h.targetName} ON ${tablen};`)
            }
          }
        }
      }

      // Mark as applied could be done here or in a separate step. For generation, just return the string.
      return sqlStatements.join('\n')
    } finally {
      connection.release()
    }
  },
}

export default tableSpecService
