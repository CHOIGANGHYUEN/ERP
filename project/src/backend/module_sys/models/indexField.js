import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class IndexField extends Model {}
IndexField.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    tablen: { type: DataTypes.STRING(45), allowNull: false },
    indexn: { type: DataTypes.STRING(45), allowNull: false },
    fieldn: { type: DataTypes.STRING(45), allowNull: false },
    module: { type: DataTypes.STRING(45), allowNull: false },
    fieldOrder: DataTypes.INTEGER,
    orderType: DataTypes.STRING(10),
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysIndexFields',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [
      { unique: true, fields: ['tablen', 'indexn', 'fieldn'], name: 'sysIndexFields_U1' },
      { fields: ['module', 'indexn'], name: 'sysIndexFields_IDX1' },
      { fields: ['fieldn'], name: 'sysIndexFields_IDX2' },
    ],
  },
)
export default IndexField
