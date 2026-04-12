import sequelize from '../../common/config/sequelize.js'
import User from './user.js'
import Role from './role.js'
import UserRole from './userRole.js'
import RoleMenu from './roleMenu.js'
import Menu from './menu.js'
import Language from './language.js'
import CodeHead from './codeHead.js'
import CodeItem from './codeItem.js'
import Table from './table.js'
import Tablex from './tablex.js'
import Field from './field.js'
import Fieldx from './fieldx.js'
import TableIndex from './tableIndex.js'
import TableIndexx from './tableIndexx.js'
import IndexField from './indexField.js'
import IndexFieldx from './indexFieldx.js'
import TableHistory from './tableHistory.js'
import Config from './config.js'
import LogLoginUser from './logLoginUser.js'
import LogUser from './logUser.js'

// 테이블 명세서 관리를 위한 핵심 Association 정의
Table.hasMany(Tablex, { foreignKey: 'tablen', sourceKey: 'tablen', as: 'names' })
Tablex.belongsTo(Table, { foreignKey: 'tablen', targetKey: 'tablen' })
Table.hasMany(Field, { foreignKey: 'tablen', sourceKey: 'tablen', as: 'fields' })
Field.belongsTo(Table, { foreignKey: 'tablen', targetKey: 'tablen' })
Field.hasMany(Fieldx, { foreignKey: 'fieldn', sourceKey: 'fieldn', as: 'names' })
Table.hasMany(TableIndex, { foreignKey: 'tablen', sourceKey: 'tablen', as: 'indexes' })
TableIndex.belongsTo(Table, { foreignKey: 'tablen', targetKey: 'tablen' })
TableIndex.hasMany(TableIndexx, { foreignKey: 'indexn', sourceKey: 'indexn', as: 'names' })
TableIndex.hasMany(IndexField, { foreignKey: 'indexn', sourceKey: 'indexn', as: 'indexFields' })

export {
  sequelize,
  User,
  Role,
  UserRole,
  RoleMenu,
  Menu,
  Language,
  CodeHead,
  CodeItem,
  Table,
  Tablex,
  Field,
  Fieldx,
  TableIndex,
  TableIndexx,
  IndexField,
  IndexFieldx,
  TableHistory,
  Config,
  LogLoginUser,
  LogUser,
}
