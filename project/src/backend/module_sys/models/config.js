import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class Config extends Model {}
Config.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    langu: { type: DataTypes.STRING(45), allowNull: false },
    configId: { type: DataTypes.STRING(45), allowNull: false },
    configLevel: { type: DataTypes.INTEGER, allowNull: false },
    ordNum: { type: DataTypes.INTEGER, allowNull: false },
    configVal: { type: DataTypes.STRING(45) },
    parentConfigId: { type: DataTypes.STRING(45) },
    useYn: { type: DataTypes.INTEGER },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
    configNm: { type: DataTypes.STRING(50) },
  },
  {
    sequelize,
    tableName: 'sysConfig',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [
      { unique: true, fields: ['langu', 'configId'], name: 'sysConfig_U1' },
      { fields: ['langu', 'parentConfigId'], name: 'sysConfig_IDX1' },
    ],
  },
)

export default Config
