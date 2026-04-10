'use strict'
const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class IndexField extends Model {
    static associate(models) {
      // IndexField (N) : Field (1)
      // tablen과 fieldn 두 개를 모두 매칭시켜야 함
      IndexField.belongsTo(models.Field, {
        foreignKey: 'fieldn', // 대표 외래키
        targetKey: 'fieldn',
        as: 'field',
      })
    }
  }
  IndexField.init(
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      tablen: { type: DataTypes.STRING(45), allowNull: false },
      indexn: { type: DataTypes.STRING(45), allowNull: false },
      fieldn: { type: DataTypes.STRING(45), allowNull: false },
      module: { type: DataTypes.STRING(45), allowNull: false },
      fieldOrder: DataTypes.INTEGER,
      orderType: DataTypes.STRING(10),
      createdBy: DataTypes.STRING(45),
      changedBy: DataTypes.STRING(45),
    },
    {
      sequelize,
      modelName: 'IndexField',
      tableName: 'sysIndexFields',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
      indexes: [
        {
          unique: true,
          fields: ['tablen', 'indexn', 'fieldn'],
          name: 'sysIndexFields_U1',
        },
        { fields: ['module', 'indexn'], name: 'sysIndexFields_IDX1' },
        { fields: ['fieldn'], name: 'sysIndexFields_IDX2' },
      ],
    },
  )
  return IndexField
}
