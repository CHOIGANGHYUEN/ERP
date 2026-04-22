import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

import { apiLogger } from './common/middleware/apiLogger.js'
import authRoutes from './module_sys/routes/authRoutes.js'
import tableSpecRoutes from './module_sys/routes/tableSpecRoutes.js'
import menuRoutes from './module_sys/routes/menuRoutes.js'
import configRoutes from './module_sys/routes/configRoutes.js'
import roleRoutes from './module_sys/routes/roleRoutes.js'
import userRoutes from './module_sys/routes/userRoutes.js'
import codeRoutes from './module_sys/routes/codeRoutes.js'
import logLoginUserRoutes from './module_sys/routes/logLoginUserRoutes.js'
import logTableHistoryRoutes from './module_sys/routes/logTableHistoryRoutes.js'
import logUserRoutes from './module_sys/routes/logUserRoutes.js'
import plantRoutes from './module_sys/routes/plantRoutes.js'
import unitRoutes from './module_sys/routes/unitRoutes.js'
import gameRoutes from './module_game/routes/gameRoutes.js'
import configService from './module_sys/services/configService.js'

const app = express()
const PORT = process.env.PORT || 3000

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(
  cors({
    origin: CORS_ORIGIN, // Configurable CORS origin
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Global API Logging Middleware (Phase 2)
// 모든 /api/* 요청의 이력(메서드, URL, 상태코드, 사용자ID)을 sysLogUser 테이블에 기록합니다.
app.use(apiLogger)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/sys/tablespecs', tableSpecRoutes)
app.use('/api/sys/menus', menuRoutes)
app.use('/api/sys/configs', configRoutes)
app.use('/api/sys/roles', roleRoutes)
app.use('/api/sys/users', userRoutes)
app.use('/api/sys/codes', codeRoutes)
app.use('/api/sys/logs/login', logLoginUserRoutes)
app.use('/api/sys/logs/table-history', logTableHistoryRoutes)
app.use('/api/sys/logs/user', logUserRoutes)
app.use('/api/sys/plants', plantRoutes)
app.use('/api/sys/units', unitRoutes)
app.use('/api/game', gameRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' })
})

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
  // DB 연결 후 기본 시스템 설정 확인 및 누락분 보완
  configService.initializeDefaultConfigs().catch((err) => {
    console.error('⚠️ 기본 시스템 설정 초기화 실패:', err.message)
  })
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Error: Port ${PORT} is already in use. The server could not start.`)
    process.exit(1)
  } else {
    console.error('Server error:', err)
    process.exit(1)
  }
})
