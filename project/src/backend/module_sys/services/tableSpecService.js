import {
  sequelize,
  Table,
  Tablex,
  Field,
  Fieldx,
  TableIndex,
  TableIndexx,
  IndexField,
  TableHistory,
} from '../models/index.js'
import { Op } from 'sequelize'

const tableSpecService = {
  async getList(params) {
    const { langu = 'KO', module, tablen, tableNm, page = 1, size = 20 } = params
    const offset = (Number(page) - 1) * Number(size)

    const where = module ? { module } : {}
    if (tablen) where.tablen = { [Op.like]: `%${tablen}%` }

    const includeWhere = { langu }
    if (tableNm) includeWhere.tableNm = { [Op.like]: `%${tableNm}%` }

    const { rows, count } = await Table.findAndCountAll({
      where,
      include: [{ model: Tablex, as: 'names', where: includeWhere, required: !!tableNm }],
      offset,
      limit: Number(size),
      order: [['tablen', 'ASC']],
      distinct: true,
    })

    const data = rows.map((r) => ({
      id: r.id,
      tablen: r.tablen,
      module: r.module,
      createdAt: r.createdAt,
      tableNm: r.names[0]?.tableNm || '',
      description: r.names[0]?.description || '',
    }))

    return { data, total: count, page: Number(page), size: Number(size) }
  },

  async getDetail(tablen, langu = 'KO') {
    const table = await Table.findOne({
      where: { tablen },
      include: [{ model: Tablex, as: 'names', where: { langu }, required: false }],
    })

    if (!table) {
      return {
        tableInfo: { tablen, module: 'SYS', tableNm: '', description: '' },
        fields: [],
        indexes: [],
        history: [],
      }
    }

    const fields = await Field.findAll({
      where: { tablen },
      include: [{ model: Fieldx, as: 'names', where: { langu }, required: false }],
      order: [['fieldOrder', 'ASC']],
    })

    // Cartesian Product(N:M 증식) 버그 방지를 위해 Index와 IndexField 조회를 분리합니다.
    const indexesData = await TableIndex.findAll({
      where: { tablen },
      include: [{ model: TableIndexx, as: 'names', where: { langu }, required: false }],
      order: [['indexn', 'ASC']],
    })

    const indexFieldsData = await IndexField.findAll({
      where: { tablen },
      order: [['fieldOrder', 'ASC']],
    })

    const indexes = indexesData.map((i) => {
      const iJson = i.toJSON()
      iJson.indexFields = indexFieldsData
        .filter((inf) => inf.indexn === iJson.indexn)
        .map((inf) => inf.toJSON())
      return iJson
    })

    const history = await TableHistory.findAll({
      where: { tablen },
      order: [['id', 'DESC']],
    })

    return {
      tableInfo: {
        ...table.toJSON(),
        tableNm: table.names[0]?.tableNm,
        description: table.names[0]?.description,
      },
      fields: fields.map((f) => ({
        ...f.toJSON(),
        fieldNm: f.names[0]?.fieldNm,
        description: f.names[0]?.description,
      })),
      indexes: indexes.map((i) => ({
        ...i,
        indexNm: i.names[0]?.indexNm,
        description: i.names[0]?.description,
      })),
      history,
    }
  },

  async saveSpec(data, user) {
    return await sequelize.transaction(async (t) => {
      const tableInfo = data.tableInfo || data
      const { tablen, module = 'SYS', langu = 'KO', tableNm = '', description = '' } = tableInfo
      const fields = data.fields || []
      const indexes = data.indexes || []

      // [정밀 비교 방어 로직] null, undefined, boolean, number 타입 차이로 인한 억울한 로깅 원천 차단
      const normStr = (v) => (v == null ? '' : String(v).trim())
      const normInt = (v) =>
        v === true || String(v) === '1' || String(v).toLowerCase() === 'true' ? '1' : '0'

      // [방어 로직] 배열 내 필드명, 인덱스명 중복 검사 (DB Unique Constraint Error 사전 방지)
      const fieldNames = fields.map((f) => f.fieldn)
      if (new Set(fieldNames).size !== fieldNames.length) {
        throw new Error('저장하려는 데이터에 중복된 필드명이 포함되어 있습니다.')
      }

      const indexNames = indexes.map((idx) => idx.indexn)
      if (new Set(indexNames).size !== indexNames.length) {
        throw new Error('저장하려는 데이터에 중복된 인덱스명이 포함되어 있습니다.')
      }

      // [방어 로직] 인덱스 대상 필드가 실제 존재하는 필드인지 검증 (오타 방지)
      for (const idx of indexes) {
        for (const inf of idx.indexFields || []) {
          if (!fieldNames.includes(inf.fieldn)) {
            throw new Error(
              `인덱스 '${idx.indexn}'에 지정된 대상 필드명 '${inf.fieldn}'은(는) 존재하지 않는 필드입니다. 오타를 확인해주세요.`,
            )
          }
        }
      }

      const oldTable = await Table.findOne({ where: { tablen }, transaction: t })
      const oldTablex = await Tablex.findOne({ where: { tablen, langu }, transaction: t })

      const oldFieldsData = await Field.findAll({
        where: { tablen },
        include: [{ model: Fieldx, as: 'names', where: { langu }, required: false }],
        transaction: t,
      })
      const oldFields = oldFieldsData.map((f) => ({
        ...f.toJSON(),
        fieldNm: f.names[0]?.fieldNm || '',
        description: f.names[0]?.description || '',
      }))

      const oldIndexesRaw = await TableIndex.findAll({
        where: { tablen },
        include: [{ model: TableIndexx, as: 'names', where: { langu }, required: false }],
        transaction: t,
      })
      const oldIndexFieldsRaw = await IndexField.findAll({
        where: { tablen },
        order: [['fieldOrder', 'ASC']],
        transaction: t,
      })
      const oldIndexes = oldIndexesRaw.map((i) => {
        const iJson = i.toJSON()
        iJson.indexFields = oldIndexFieldsRaw
          .filter((inf) => inf.indexn === iJson.indexn)
          .map((inf) => inf.toJSON())
        return {
          ...iJson,
          indexNm: iJson.names[0]?.indexNm || '',
          description: iJson.names[0]?.description || '',
        }
      })

      const logHistory = async (actionType, targetType, targetName, oldV, newV) => {
        await TableHistory.create(
          {
            tablen,
            actionType,
            targetType,
            targetName,
            beforeValue: JSON.stringify(oldV),
            afterValue: JSON.stringify(newV),
            isApplied: 0,
            createdBy: user,
          },
          { transaction: t },
        )
      }

      if (!oldTable) {
        await Table.create({ tablen, module, createdBy: user }, { transaction: t })
        await Tablex.create({ tablen, langu, module, tableNm, description }, { transaction: t })
        await logHistory('INSERT', 'TABLE', tablen, null, { tablen, module, tableNm, description })
      } else {
        const oldTableNm = oldTablex ? normStr(oldTablex.tableNm) : ''
        const oldDescr = oldTablex ? normStr(oldTablex.description) : ''
        const newTableNm = normStr(tableNm)
        const newDescr = normStr(description)

        if (oldTableNm !== newTableNm || oldDescr !== newDescr) {
          if (oldTablex) {
            await oldTablex.update({ tableNm, description }, { transaction: t })
          } else {
            await Tablex.create({ tablen, langu, module, tableNm, description }, { transaction: t })
          }
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
          await Field.create(
            {
              tablen,
              fieldn: f.fieldn,
              module,
              fieldType: f.fieldType,
              fieldLength: f.fieldLength || null,
              fieldKey: f.fieldKey || '',
              isNull: f.isNull || 0,
              isAutoIncrement: f.isAutoIncrement || 0,
              fieldOrder: f.fieldOrder || 0,
              createdBy: user,
            },
            { transaction: t },
          )

          await Fieldx.create(
            {
              tablen,
              fieldn: f.fieldn,
              langu,
              module,
              fieldNm: f.fieldNm || '',
              description: f.description || '',
            },
            { transaction: t },
          )

          await logHistory('INSERT', 'FIELD', f.fieldn, null, f)
        } else {
          const old = oldFieldsMap[f.fieldn]
          const isDiff =
            normStr(old.fieldType).toUpperCase() !== normStr(f.fieldType).toUpperCase() ||
            normStr(old.fieldLength) !== normStr(f.fieldLength) ||
            normStr(old.fieldKey) !== normStr(f.fieldKey) ||
            normInt(old.isNull) !== normInt(f.isNull) ||
            normInt(old.isAutoIncrement) !== normInt(f.isAutoIncrement) ||
            normStr(old.fieldOrder) !== normStr(f.fieldOrder) ||
            normStr(old.fieldNm) !== normStr(f.fieldNm) ||
            normStr(old.description) !== normStr(f.description)
          if (isDiff) {
            await Field.update(
              {
                fieldType: f.fieldType,
                fieldLength: f.fieldLength || null,
                fieldKey: f.fieldKey || '',
                isNull: f.isNull || 0,
                isAutoIncrement: f.isAutoIncrement || 0,
                fieldOrder: f.fieldOrder || 0,
                changedBy: user,
              },
              { where: { tablen, fieldn: f.fieldn }, transaction: t },
            )

            const fieldx = await Fieldx.findOne({
              where: { tablen, fieldn: f.fieldn, langu },
              transaction: t,
            })
            if (fieldx) {
              await fieldx.update(
                { fieldNm: f.fieldNm || '', description: f.description || '' },
                { transaction: t },
              )
            } else {
              await Fieldx.create(
                {
                  tablen,
                  fieldn: f.fieldn,
                  langu,
                  module,
                  fieldNm: f.fieldNm || '',
                  description: f.description || '',
                },
                { transaction: t },
              )
            }

            await logHistory('UPDATE', 'FIELD', f.fieldn, old, f)
          }
          delete oldFieldsMap[f.fieldn]
        }
      }
      for (const [fieldn, oldF] of Object.entries(oldFieldsMap)) {
        await Fieldx.destroy({ where: { tablen, fieldn }, transaction: t })
        await Field.destroy({ where: { tablen, fieldn }, transaction: t })
        await logHistory('DELETE', 'FIELD', fieldn, oldF, null)
      }

      const oldIndexesMap = Object.fromEntries(oldIndexes.map((i) => [i.indexn, i]))
      for (const i of indexes) {
        if (!oldIndexesMap[i.indexn]) {
          await TableIndex.create(
            {
              tablen,
              indexn: i.indexn,
              module,
              isUnique: i.isUnique || 0,
              createdBy: user,
            },
            { transaction: t },
          )
          await TableIndexx.create(
            {
              tablen,
              indexn: i.indexn,
              langu,
              module,
              indexNm: i.indexNm || '',
              description: i.description || '',
            },
            { transaction: t },
          )

          for (const inf of i.indexFields || []) {
            await IndexField.create(
              {
                tablen,
                indexn: i.indexn,
                fieldn: inf.fieldn,
                module,
                fieldOrder: inf.fieldOrder || 0,
              },
              { transaction: t },
            )
          }
          await logHistory('INSERT', 'INDEX', i.indexn, null, i)
        } else {
          const old = oldIndexesMap[i.indexn]
          const oldIndexFieldsStr = (old.indexFields || [])
            .map((inf) => normStr(inf.fieldn))
            .join(',')
          const newIndexFieldsStr = (i.indexFields || [])
            .map((inf) => normStr(inf.fieldn))
            .join(',')

          const isDiff =
            normInt(old.isUnique) !== normInt(i.isUnique) ||
            normStr(old.indexNm) !== normStr(i.indexNm) ||
            normStr(old.description) !== normStr(i.description) ||
            oldIndexFieldsStr !== newIndexFieldsStr

          if (isDiff) {
            await TableIndex.update(
              { isUnique: i.isUnique || 0, changedBy: user },
              { where: { tablen, indexn: i.indexn }, transaction: t },
            )

            const idxX = await TableIndexx.findOne({
              where: { tablen, indexn: i.indexn, langu },
              transaction: t,
            })
            if (idxX) {
              await idxX.update(
                { indexNm: i.indexNm || '', description: i.description || '' },
                { transaction: t },
              )
            } else {
              await TableIndexx.create(
                {
                  tablen,
                  indexn: i.indexn,
                  langu,
                  module,
                  indexNm: i.indexNm || '',
                  description: i.description || '',
                },
                { transaction: t },
              )
            }

            // 실제 변경이 있을 때만 하위 인덱스 필드들도 갱신합니다.
            await IndexField.destroy({ where: { tablen, indexn: i.indexn }, transaction: t })
            for (const inf of i.indexFields || []) {
              await IndexField.create(
                {
                  tablen,
                  indexn: i.indexn,
                  fieldn: inf.fieldn,
                  module,
                  fieldOrder: inf.fieldOrder || 0,
                },
                { transaction: t },
              )
            }
            await logHistory('UPDATE', 'INDEX', i.indexn, old, i)
          }
          delete oldIndexesMap[i.indexn]
        }
      }
      for (const [indexn, oldI] of Object.entries(oldIndexesMap)) {
        await IndexField.destroy({ where: { tablen, indexn }, transaction: t })
        await TableIndexx.destroy({ where: { tablen, indexn }, transaction: t })
        await TableIndex.destroy({ where: { tablen, indexn }, transaction: t })
        await logHistory('DELETE', 'INDEX', indexn, oldI, null)
      }

      return { success: true }
    })
  },

  async generateSql(tablen) {
    const histories = await TableHistory.findAll({
      where: { tablen, isApplied: 0 },
      order: [['id', 'ASC']],
    })

    if (histories.length === 0) {
      return '/* 대기 중인 변경 사항이 없습니다. (모든 이력이 이미 DB에 적용 완료되었습니다.) */'
    }

    let sqlStatements = []
    let isCreateTable = histories.some((h) => h.targetType === 'TABLE' && h.actionType === 'INSERT')

    if (isCreateTable) {
      const fieldRows = await Field.findAll({
        where: { tablen },
        order: [['fieldOrder', 'ASC']],
      })
      const indexRows = await TableIndex.findAll({
        where: { tablen },
      })

      let createSql = `CREATE TABLE ${tablen} (\n`
      let fieldSqls = []
      let pks = []
      for (const f of fieldRows) {
        let fSql = `  ${f.fieldn} ${f.fieldType}${f.fieldLength ? '(' + f.fieldLength + ')' : ''} ${f.isNull ? '' : 'NOT NULL'}${f.isAutoIncrement ? ' AUTO_INCREMENT' : ''}`
        fieldSqls.push(fSql)
        if (f.fieldKey === 'PRI') pks.push(f.fieldn)
      }
      if (pks.length > 0) {
        fieldSqls.push(`  PRIMARY KEY (${pks.join(', ')})`)
      }
      createSql += fieldSqls.join(',\n') + '\n);'
      sqlStatements.push(createSql)

      for (const idx of indexRows) {
        const idxFields = await IndexField.findAll({
          where: { tablen, indexn: idx.indexn },
          order: [['fieldOrder', 'ASC']],
        })
        const fnames = idxFields.map((inf) => inf.fieldn).join(', ')
        let idxSql = `CREATE ${idx.isUnique ? 'UNIQUE ' : ''}INDEX ${idx.indexn} ON ${tablen} (${fnames});`
        sqlStatements.push(idxSql)
      }
    } else {
      for (const h of histories) {
        if (h.targetType === 'FIELD') {
          const newV = JSON.parse(h.afterValue || '{}')
          if (h.actionType === 'INSERT') {
            sqlStatements.push(
              `ALTER TABLE ${tablen} ADD COLUMN ${h.targetName} ${newV.fieldType}${newV.fieldLength ? '(' + newV.fieldLength + ')' : ''} ${newV.isNull ? '' : 'NOT NULL'}${newV.isAutoIncrement ? ' AUTO_INCREMENT' : ''};`,
            )
          } else if (h.actionType === 'UPDATE') {
            sqlStatements.push(
              `ALTER TABLE ${tablen} MODIFY COLUMN ${h.targetName} ${newV.fieldType}${newV.fieldLength ? '(' + newV.fieldLength + ')' : ''} ${newV.isNull ? '' : 'NOT NULL'}${newV.isAutoIncrement ? ' AUTO_INCREMENT' : ''};`,
            )
          } else if (h.actionType === 'DELETE') {
            sqlStatements.push(`ALTER TABLE ${tablen} DROP COLUMN ${h.targetName};`)
          }
        } else if (h.targetType === 'INDEX') {
          if (h.actionType === 'INSERT') {
            const newV = JSON.parse(h.afterValue || '{}')
            const idxFields = await IndexField.findAll({
              where: { tablen, indexn: h.targetName },
              order: [['fieldOrder', 'ASC']],
            })
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
  },

  async generateInsertSql(tablen) {
    const tableSpec = await this.getDetail(tablen, 'KO')
    if (!tableSpec || !tableSpec.fields || tableSpec.fields.length === 0) {
      throw new Error(`'${tablen}' 테이블의 명세 정보를 찾을 수 없거나 필드가 없습니다.`)
    }

    const fieldsToInsert = tableSpec.fields.filter((field) => !field.isAutoIncrement)

    if (fieldsToInsert.length === 0) {
      return `-- '${tablen}' 테이블에 INSERT 할 필드가 없습니다 (AUTO_INCREMENT 키만 존재).`
    }

    const columnNames = fieldsToInsert.map((f) => `\`${f.fieldn}\``).join(', ')

    const valuePlaceholders = fieldsToInsert
      .map((f) => {
        const fieldType = (f.fieldType || '').toUpperCase()
        if (
          fieldType.includes('INT') ||
          fieldType.includes('DECIMAL') ||
          fieldType.includes('FLOAT') ||
          fieldType.includes('DOUBLE')
        )
          return '0'
        if (fieldType.includes('DATE') || fieldType.includes('TIME')) return 'NOW()'
        if (fieldType.includes('BOOL') || fieldType === 'TINYINT(1)') return '1'
        return `'[${f.fieldn}]'`
      })
      .join(', ')

    return `INSERT INTO \`${tableSpec.tableInfo.tablen}\` (${columnNames})\nVALUES (${valuePlaceholders});`
  },

  async generateUpdateSql(tablen) {
    const tableSpec = await this.getDetail(tablen, 'KO')
    if (!tableSpec || !tableSpec.fields || tableSpec.fields.length === 0) {
      throw new Error(`'${tablen}' 테이블의 명세 정보를 찾을 수 없거나 필드가 없습니다.`)
    }

    const fieldsToUpdate = tableSpec.fields.filter((field) => !field.isAutoIncrement)
    const primaryKeys = tableSpec.fields.filter((field) => field.fieldKey === 'PRI')

    if (fieldsToUpdate.length === 0) {
      return `-- '${tablen}' 테이블에 UPDATE 할 필드가 없습니다.`
    }

    const setStatements = fieldsToUpdate
      .map((f) => {
        const fieldType = (f.fieldType || '').toUpperCase()
        let val = `'[${f.fieldn}]'`
        if (
          fieldType.includes('INT') ||
          fieldType.includes('DECIMAL') ||
          fieldType.includes('FLOAT') ||
          fieldType.includes('DOUBLE')
        )
          val = '0'
        if (fieldType.includes('DATE') || fieldType.includes('TIME')) val = 'NOW()'
        if (fieldType.includes('BOOL') || fieldType === 'TINYINT(1)') val = '1'
        return `  \`${f.fieldn}\` = ${val}`
      })
      .join(',\n')

    let whereClause = ''
    if (primaryKeys.length > 0) {
      whereClause =
        '\nWHERE ' + primaryKeys.map((pk) => `\`${pk.fieldn}\` = '[${pk.fieldn}]'`).join(' AND ')
    } else {
      whereClause = '\nWHERE 1=1 /* 주의: 조건절을 입력하세요 */'
    }

    return `UPDATE \`${tableSpec.tableInfo.tablen}\`\nSET\n${setStatements}${whereClause};`
  },

  async executeRawSql(tablen, sql) {
    if (!sql || sql.trim().startsWith('/* No pending') || sql.trim() === '') {
      throw new Error('실행할 유효한 SQL 구문이 없습니다.')
    }

    // 1. 전달받은 전체 SQL 스크립트 실행 (multipleStatements 옵션 활성화 필요)
    await sequelize.query(sql)

    // 2. DDL 구문(CREATE, ALTER, DROP)을 실행한 경우, 대기 중인 이력을 '적용 완료(isApplied: 1)'로 마킹
    const upperSql = sql.toUpperCase()
    const isDdl =
      upperSql.includes('CREATE ') || upperSql.includes('ALTER ') || upperSql.includes('DROP ')
    if (isDdl) {
      await TableHistory.update({ isApplied: 1 }, { where: { tablen, isApplied: 0 } })
    }

    return { success: true }
  },
}

export default tableSpecService
