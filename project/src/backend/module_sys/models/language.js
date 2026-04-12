import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class Language extends Model {}
Language.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    langu: { type: DataTypes.STRING(45), allowNull: false, unique: true },
    languNm: DataTypes.STRING(45),
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysLanguage',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
  },
)

export default Language
