import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class Menu extends Model {}
Menu.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    langu: { type: DataTypes.STRING(45), allowNull: false },
    menuId: { type: DataTypes.STRING(45), allowNull: false },
    menuLevel: { type: DataTypes.INTEGER, allowNull: false },
    ordNum: { type: DataTypes.INTEGER, allowNull: false },
    menuNm: DataTypes.STRING(45),
    description: DataTypes.STRING(200),
    parentMenuId: DataTypes.STRING(45),
    path: DataTypes.STRING(255),
    useYn: DataTypes.INTEGER,
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysMenu',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [{ unique: true, fields: ['langu', 'menuId'], name: 'sysMenu_U1' }],
  },
)

export default Menu
