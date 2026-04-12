import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class IndexFieldx extends Model {}
IndexFieldx.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    langu: { type: DataTypes.STRING(10), allowNull: false },
    tablen: { type: DataTypes.STRING(45), allowNull: false },
    fieldn: { type: DataTypes.STRING(45), allowNull: false },
    indexn: { type: DataTypes.STRING(45), allowNull: false },
    module: { type: DataTypes.STRING(45), allowNull: false },
    indexNm: DataTypes.STRING(100),
    description: DataTypes.STRING(255),
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysIndexFieldsx',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [
      { unique: true, fields: ['langu', 'tablen', 'fieldn', 'indexn'], name: 'sysTableIndexx_U1' },
      { fields: ['module'], name: 'sysIndexFieldsx_IDX1' },
    ],
  },
)
export default IndexFieldx
