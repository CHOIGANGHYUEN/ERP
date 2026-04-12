import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class CodeHead extends Model {}
CodeHead.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    categoryCode: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysCodeHead_U1' },
    groupCode: { type: DataTypes.STRING(45), allowNull: false, unique: 'sysCodeHead_U1' },
    description: DataTypes.STRING(300),
    useYn: DataTypes.INTEGER,
    fieldNm1: DataTypes.STRING(45),
    fieldNm2: DataTypes.STRING(45),
    fieldNm3: DataTypes.STRING(45),
    fieldNm4: DataTypes.STRING(45),
    fieldNm5: DataTypes.STRING(45),
    fieldNm6: DataTypes.STRING(45),
    fieldNm7: DataTypes.STRING(45),
    fieldNm8: DataTypes.STRING(45),
    fieldNm9: DataTypes.STRING(45),
    fieldNm10: DataTypes.STRING(45),
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysCodeHead',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
  },
)

export default CodeHead
