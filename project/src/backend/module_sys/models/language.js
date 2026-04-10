'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Language extends Model {
    static associate(models) {
      // define association here
    }
  }
  Language.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      langu: {
        type: DataTypes.STRING(45),
        allowNull: false,
        unique: true,
      },
      languNm: DataTypes.STRING(45),
      createdBy: DataTypes.STRING(45),
      createdAt: DataTypes.DATE,
      changedBy: DataTypes.STRING(45),
      changedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Language',
      tableName: 'sysLanguage',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
    },
  )
  return Language
}
