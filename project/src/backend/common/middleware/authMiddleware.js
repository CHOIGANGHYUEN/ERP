import jwt from 'jsonwebtoken'
import logger from '../config/logger.js'
import SysConstants from '../config/constants.js'

/**
 * Global Token Validation Middleware
 * Intercepts API requests to ensure a valid JWT is present.
 */
export const verifyToken = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next()
  }

  try {
    let token = req.cookies?.token

    if (!token) {
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1]
      }
    }

    if (!token) {
      console.warn(`[Auth] 인증 토큰 없음 - URL: ${req.originalUrl}`)
      return res
        .status(SysConstants.HTTP_STATUS.UNAUTHORIZED)
        .json({ message: '인증 토큰이 필요합니다.' })
    }

    const secret = process.env.JWT_SECRET || 'your_fallback_secret_key_123'
    try {
      const decoded = jwt.verify(token, secret)
      req.user = decoded
      console.log(`[Auth] 인증 성공: ${decoded.userId || decoded.email} (ID: ${decoded.id})`)
      next()
    } catch (jwtError) {
      console.error(`[Auth] 토큰 검증 실패 - 이유: ${jwtError.message}`)
      return res
        .status(SysConstants.HTTP_STATUS.UNAUTHORIZED)
        .json({ message: '유효하지 않은 토큰입니다.' })
    }
  } catch (error) {
    console.error(`[Auth] 미들웨어 시스템 에러: ${error.message}`)
    return res.status(500).json({ message: '인증 처리 중 오류 발생' })
  }
}
