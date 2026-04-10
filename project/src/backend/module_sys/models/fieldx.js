'use strict'
const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class Fieldx extends Model {
    static associate(models) {
      Fieldx.belongsTo(models.Field, {
        foreignKey: 'fieldn',
        targetKey: 'fieldn',
        scope: {
          langu: 'KO',
        },
      })
    }
  }
  Fieldx.init(
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
      fieldn: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      module: DataTypes.STRING(45),
      fieldNm: DataTypes.STRING(100),
      description: DataTypes.STRING(255),
      createdBy: DataTypes.STRING(45),
      changedBy: DataTypes.STRING(45),
    },
    {
      sequelize,
      modelName: 'Fieldx',
      tableName: 'sysFieldsx',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      indexes: [
        {
          unique: true,
          fields: ['langu', 'tablen', 'fieldn'],
          name: 'sysFieldsx_U1',
        },
      ],
    },
  )
  return Fieldx
}
