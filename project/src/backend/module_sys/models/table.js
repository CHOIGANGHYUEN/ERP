'use strict'
const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class Table extends Model {
    static associate(models) {
      Table.hasMany(models.Tablex, {
        foreignKey: 'tablen',
        sourceKey: 'tablen',
        as: 'names',
      })
      Table.hasMany(models.Field, {
        foreignKey: 'tablen',
        sourceKey: 'tablen',
        as: 'field',
      })
      Table.hasMany(models.TableIndex, {
        foreignKey: 'tablen',
        sourceKey: 'tablen',
        as: 'tableindex',
      })
    }
  }
  Table.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      tablen: {
        type: DataTypes.STRING(45),
        allowNull: false,
        unique: 'sysTable_U1',
      },
      module: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      createdBy: DataTypes.STRING(45),
      createdAt: DataTypes.DATE,
      changedBy: DataTypes.STRING(45),
      changedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Table',
      tableName: 'sysTable',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      indexes: [{ fields: ['module'], name: 'sysTable_IDX1' }],
    },
  )
  return Table
}
