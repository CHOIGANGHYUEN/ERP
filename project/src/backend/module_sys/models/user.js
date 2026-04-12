import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class User extends Model {}

User.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysUser_U1' },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysUser',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
  },
)

export default User
