import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class CodeItem extends Model {}
CodeItem.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    categoryCode: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysCodeItem_U1' },
    groupCode: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysCodeItem_U1' },
    subCode: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysCodeItem_U1' },
    description: DataTypes.STRING(300),
    useYn: DataTypes.INTEGER,
    field1: DataTypes.STRING(45),
    field2: DataTypes.STRING(45),
    field3: DataTypes.STRING(45),
    field4: DataTypes.STRING(45),
    field5: DataTypes.STRING(45),
    field6: DataTypes.STRING(45),
    field7: DataTypes.STRING(45),
    field8: DataTypes.STRING(45),
    field9: DataTypes.STRING(45),
    field10: DataTypes.STRING(45),
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysCodeItem',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
  },
)

export default CodeItem
