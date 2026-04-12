import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class TableIndex extends Model {}
TableIndex.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    tablen: { type: DataTypes.STRING(45), allowNull: false },
    indexn: { type: DataTypes.STRING(45), allowNull: false },
    module: { type: DataTypes.STRING(45), allowNull: false },
    isUnique: DataTypes.INTEGER,
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysTableIndex',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [
      { unique: true, fields: ['tablen', 'indexn'], name: 'sysTableIndex_U1' },
      { fields: ['module', 'indexn'], name: 'sysTableIndex_IDX1' },
    ],
  },
)
export default TableIndex
