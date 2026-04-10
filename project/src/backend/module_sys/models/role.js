'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      // Role can be associated with many UserRoles
      Role.hasMany(models.UserRole, { foreignKey: 'roleId', sourceKey: 'roleId' })
    }
  }
  Role.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      roleId: {
        type: DataTypes.STRING(45),
        allowNull: false,
        unique: true,
      },
      description: DataTypes.STRING(45),
      useYn: DataTypes.INTEGER,
      createdBy: DataTypes.STRING(45),
      createdAt: DataTypes.DATE,
      changedBy: DataTypes.STRING(45),
      changedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Role',
      tableName: 'sysRole',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'changedAt',
    },
  )
  return Role
}
