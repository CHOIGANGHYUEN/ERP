'use strict'
const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class Field extends Model {
    static associate(models) {
      Field.belongsTo(models.Table, {
        foreignKey: 'tablen',
        targetKey: 'tablen',
      })
      Field.hasMany(models.Fieldx, {
        foreignKey: 'fieldn',
        sourceKey: 'fieldn',
        as: 'fieldx',
      })
    }
  }
  Field.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
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
      fieldOrder: DataTypes.INTEGER,
      fieldType: DataTypes.STRING(45),
      fieldLength: DataTypes.INTEGER,
      fieldPoint: DataTypes.INTEGER,
      fieldKey: DataTypes.STRING(45),
      isNull: DataTypes.INTEGER,
      isUnique: DataTypes.INTEGER,
      isNonUnique: DataTypes.INTEGER,
      isAutoIncrement: DataTypes.INTEGER,
      createdBy: DataTypes.STRING(45),
      changedBy: DataTypes.STRING(45),
    },
    {
      sequelize,
      modelName: 'Field',
      tableName: 'sysFields',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      indexes: [{ unique: true, fields: ['tablen', 'fieldn'], name: 'sysFields_U1' }],
    },
  )
  return Field
}
