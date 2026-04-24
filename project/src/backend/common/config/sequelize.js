import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true })

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  timezone: '+09:00', // 한국 표준시 설정
  logging: false,
  dialectOptions: {
    multipleStatements: true,
    dateStrings: true,
    typeCast: true,
  },
})

export default sequelize
