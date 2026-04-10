'use strict'
const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class Tablex extends Model {
    static associate(models) {
      Tablex.belongsTo(models.Table, {
        foreignKey: 'tablen',
        targetKey: 'tablen',
      })
    }
  }
  Tablex.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      langu: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      tablen: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      module: DataTypes.STRING(45),
      tableNm: DataTypes.STRING(100),
      description: DataTypes.STRING(255),
      createdBy: DataTypes.STRING(45),
      changedBy: DataTypes.STRING(45),
    },
    {
      sequelize,
      modelName: 'Tablex',
      tableName: 'sysTablex',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      indexes: [{ unique: true, fields: ['langu', 'tablen'], name: 'sysTablex_U1' }],
    },
  )
  return Tablex
}
