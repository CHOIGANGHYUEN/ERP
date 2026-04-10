'use strict'
const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class TableIndex extends Model {
    static associate(models) {
      TableIndex.belongsTo(models.Table, {
        foreignKey: 'tablen',
        targetKey: 'tablen',
      })
      TableIndex.hasMany(models.TableIndexx, {
        foreignKey: 'indexn',
        sourceKey: 'indexn',
        as: 'tableindexx',
      })
      TableIndex.hasMany(models.IndexField, {
        foreignKey: 'indexn',
        sourceKey: 'indexn',
        as: 'fields',
      })
    }
  }
  TableIndex.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      tablen: { type: DataTypes.STRING(45), allowNull: false },
      indexn: { type: DataTypes.STRING(45), allowNull: false },
      module: { type: DataTypes.STRING(45), allowNull: false },
      isUnique: DataTypes.INTEGER,
      createdBy: DataTypes.STRING(45),
      changedBy: DataTypes.STRING(45),
    },
    {
      sequelize,
      modelName: 'TableIndex',
      tableName: 'sysTableIndex',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      indexes: [
        {
          unique: true,
          fields: ['tablen', 'indexn'],
          name: 'sysTableIndex_U1',
        },
        { fields: ['module', 'indexn'], name: 'sysTableIndex_IDX1' },
      ],
    },
  )
  return TableIndex
}
