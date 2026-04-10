import winston from 'winston'
import 'winston-daily-rotate-file'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { combine, timestamp, printf, colorize } = winston.format

const logDir = path.join(__dirname, '..', 'logs')

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

const sensitiveDataFilter = winston.format((info) => {
  const sensitiveKeys = [
    'password',
    'accessToken',
    'refreshToken',
    'token',
    'authorization',
    'apiKey',
  ]
  if (info.message && typeof info.message === 'string') {
    sensitiveKeys.forEach((key) => {
      const regex = new RegExp(`("${key}"\\s*:\\s*")([^"]+)(")`, 'gi')
      info.message = info.message.replace(regex, '$1********$3')
    })
  }
  return info
})

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`
})

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(sensitiveDataFilter(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
      handleExceptions: true,
    }),
    new winston.transports.DailyRotateFile({
      level: 'info',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir,
      filename: `%DATE%.log`,
      maxFiles: '14d',
      zippedArchive: true,
      handleExceptions: true,
    }),
    new winston.transports.DailyRotateFile({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: path.join(logDir, 'error'),
      filename: `%DATE%.error.log`,
      maxFiles: '30d',
      zippedArchive: true,
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
})

logger.stream = {
  write: (message) => {
    logger.info(message.trim())
  },
}

export default logger
