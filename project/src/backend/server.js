import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import authRoutes from './module_sys/routes/authRoutes.js'
import tableSpecRoutes from './module_sys/routes/tableSpecRoutes.js'
import menuRoutes from './module_sys/routes/menuRoutes.js'
import configRoutes from './module_sys/routes/configRoutes.js'
import roleRoutes from './module_sys/routes/roleRoutes.js'

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
app.use(cookieParser())

// Request logging middleware
app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.url}`)
  next()
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/sys/tablespecs', tableSpecRoutes)
app.use('/api/sys/menus', menuRoutes)
app.use('/api/sys/configs', configRoutes)
app.use('/api/sys/roles', roleRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' })
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
