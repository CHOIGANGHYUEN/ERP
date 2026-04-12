import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class Plant extends Model {}

Plant.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    company: { type: DataTypes.STRING(45), allowNull: false, unique: 'company' },
    plant: { type: DataTypes.STRING(45), allowNull: false, unique: 'plant' },
    regNo: { type: DataTypes.STRING(20) },
    telNo: { type: DataTypes.STRING(20) },
    zipCode: { type: DataTypes.STRING(10) },
    addr: { type: DataTypes.STRING(255) },
    addrDetail: { type: DataTypes.STRING(255) },
    useYn: { type: DataTypes.INTEGER },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysPlant',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [{ unique: true, fields: ['company', 'plant'], name: 'sysPlant_U1' }],
  },
)

export default Plant
