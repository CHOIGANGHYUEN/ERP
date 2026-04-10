'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Menu extends Model {
    static associate(models) {
      // define association here
    }
  }
  Menu.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      langu: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      menuId: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      menuLevel: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ordNum: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      menuNm: DataTypes.STRING(45),
      description: DataTypes.STRING(200),
      parentMenuId: DataTypes.STRING(45),
      path: DataTypes.STRING(255),
      useYn: DataTypes.INTEGER,
      createdBy: DataTypes.STRING(45),
      createdAt: DataTypes.DATE,
      changedBy: DataTypes.STRING(45),
      changedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Menu',
      tableName: 'sysMenu',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      uniqueKeys: {
        sysMenu_U1: {
          fields: ['langu', 'menuId'],
        },
      },
    },
  )
  return Menu
}
