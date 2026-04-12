import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class Role extends Model {}
Role.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    roleId: { type: DataTypes.STRING(45), allowNull: false, unique: true },
    description: DataTypes.STRING(45),
    useYn: DataTypes.INTEGER,
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysRole',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
  },
)

export default Role
