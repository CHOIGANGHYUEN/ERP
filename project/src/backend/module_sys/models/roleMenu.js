import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class RoleMenu extends Model {}
RoleMenu.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    roleId: { type: DataTypes.STRING(45), allowNull: false },
    menuId: { type: DataTypes.STRING(45), allowNull: false },
    useYn: DataTypes.INTEGER,
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysRoleMenu',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [{ unique: true, fields: ['roleId', 'menuId'], name: 'sysRoleMenu_U1' }],
  },
)

export default RoleMenu
