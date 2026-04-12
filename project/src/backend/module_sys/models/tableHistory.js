import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class TableHistory extends Model {}
TableHistory.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    tablen: { type: DataTypes.STRING(45), allowNull: false },
    actionType: { type: DataTypes.STRING(20) },
    targetType: { type: DataTypes.STRING(20) },
    targetName: { type: DataTypes.STRING(45) },
    beforeValue: { type: DataTypes.TEXT },
    afterValue: { type: DataTypes.TEXT },
    isApplied: { type: DataTypes.INTEGER, defaultValue: 0 },
    createdBy: DataTypes.STRING(45),
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'sysTableHistory',
    timestamps: true,
    updatedAt: false,
  },
)

export default TableHistory
