'use strict'
const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class TableIndexx extends Model {
    static associate(models) {
      TableIndexx.belongsTo(models.TableIndex, {
        foreignKey: 'indexn',
        targetKey: 'indexn',
        scope: {
          langu: 'KO',
        },
      })
    }
  }
  TableIndexx.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      langu: { type: DataTypes.STRING(10), allowNull: false },
      tablen: { type: DataTypes.STRING(45), allowNull: false },
      indexn: { type: DataTypes.STRING(45), allowNull: false },
      module: { type: DataTypes.STRING(45), allowNull: false },
      indexNm: DataTypes.STRING(100),
      description: DataTypes.STRING(255),
      createdBy: DataTypes.STRING(45),
      changedBy: DataTypes.STRING(45),
    },
    {
      sequelize,
      modelName: 'TableIndexx',
      tableName: 'sysTableIndexx',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      indexes: [
        {
          unique: true,
          fields: ['langu', 'tablen', 'indexn'],
          name: 'sysTableIndexx_U1',
        },
        { fields: ['module'], name: 'sysTableIndexx_IDX1' },
      ],
    },
  )
  return TableIndexx
}
