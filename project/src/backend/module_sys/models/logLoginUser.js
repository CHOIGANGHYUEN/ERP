import { Model, DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

class LogLoginUser extends Model {}

LogLoginUser.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    loginDt: { type: DataTypes.DATEONLY, allowNull: false },
    userId: { type: DataTypes.STRING(45), allowNull: false },
    loginAt: { type: DataTypes.DATE, allowNull: false },
    logged: { type: DataTypes.TEXT },
    authorize: { type: DataTypes.STRING(255), allowNull: false },
    createdBy: DataTypes.STRING(45),
    changedBy: DataTypes.STRING(45),
  },
  {
    sequelize,
    tableName: 'sysLogLoginUser',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'changedAt',
    indexes: [
      // 특정 날짜에 접속한 사용자들을 최신순으로 조회
      { name: 'sysLogLoginUser_IDX1', fields: ['loginDt', 'userId', 'loginAt'] },
      // 특정 사용자의 최근 로그인 히스토리를 조회할 때 매우 빠름
      { name: 'sysLogLoginUser_IDX2', fields: ['userId', 'loginAt'] },
      // 특정 인증값(Authorize)으로 사용자를 찾거나 중복 체크 시 유리
      { name: 'sysLogLoginUser_IDX3', fields: ['authorize', 'userId'] },
    ],
  },
)

export default LogLoginUser
