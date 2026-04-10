import mysql from 'mysql2/promise'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

pool
  .getConnection()
  .then((connection) => {
    console.log('✅ MySQL 데이터베이스 연결 성공')
    connection.release()
  })
  .catch((err) => {
    console.error('❌ MySQL 연결 실패:', err)
  })

export default pool
