import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class Unit extends Model {}

Unit.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    unit: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysUnit_U1' },
    unitNm: { type: DataTypes.STRING(100) },
    baseUnitYn: { type: DataTypes.INTEGER },
    baseUnit: { type: DataTypes.STRING(45) },
    convRate: { type: DataTypes.DECIMAL(15, 5) },
    useYn: { type: DataTypes.STRING(255) }, // DDL 기준에 맞춤
    dispOrd: { type: DataTypes.INTEGER },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysUnit',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
  },
)

export default Unit
