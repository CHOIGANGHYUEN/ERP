import { DataTypes } from 'sequelize'
import sequelize from '../../common/config/sequelize.js'

const GameState = sequelize.define(
  'GameState',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    worldName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    population: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    worldData: {
      type: DataTypes.JSON, // JSON 타입으로 월드 내 엔티티의 상태 배열을 저장
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'anonymous',
    },
  },
  {
    tableName: 'game_states',
    timestamps: true,
  },
)

export default GameState
