import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class UserRole extends Model {}

UserRole.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING(45), allowNull: false },
    roleId: { type: DataTypes.STRING(45), allowNull: false },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysUserRole',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [{ unique: true, fields: ['userId', 'roleId'], name: 'sysUserRole_U1' }],
  },
)

export default UserRole
