import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class LogUser extends Model {}

LogUser.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    logDt: { type: DataTypes.DATEONLY, allowNull: false },
    userId: { type: DataTypes.STRING(45), allowNull: false },
    menuId: { type: DataTypes.STRING(50) },
    logAt: { type: DataTypes.DATE, allowNull: false },
    logged: { type: DataTypes.TEXT },
    params: { type: DataTypes.STRING(255) },
    request: { type: DataTypes.TEXT },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysLogUser',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [
      { name: 'sysLogUser_IDX1', fields: ['logDt', 'userId', 'logAt'] },
      { name: 'sysLogUser_IDX2', fields: ['userId', 'logAt'] },
      { name: 'sysLogUser_IDX3', fields: ['menuId', 'userId', 'logAt'] },
    ],
  },
)

export default LogUser
