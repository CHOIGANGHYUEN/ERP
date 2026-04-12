import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class Table extends Model {}
Table.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    tablen: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysTable_U1' },
    module: { type: DataTypes.STRING(45), allowNull: false },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysTable',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [{ fields: ['module'], name: 'sysTable_IDX1' }],
  },
)

export default Table
