'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class UserRole extends Model {
    static associate(models) {
      // UserRole belongs to a Role
      UserRole.belongsTo(models.Role, { foreignKey: 'roleId', targetKey: 'roleId' })
    }
  }
  UserRole.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      roleId: {
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
      modelName: 'UserRole',
      tableName: 'sysUserRole',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
    },
  )
  return UserRole
}
