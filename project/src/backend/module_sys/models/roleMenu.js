'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class RoleMenu extends Model {
    static associate(models) {
      // define association here
    }
  }
  RoleMenu.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      roleId: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      menuId: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      useYn: DataTypes.INTEGER,
      createdBy: DataTypes.STRING(45),
      createdAt: DataTypes.DATE,
      changedBy: DataTypes.STRING(45),
      changedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'RoleMenu',
      tableName: 'sysRoleMenu',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
    },
  )
  return RoleMenu
}
