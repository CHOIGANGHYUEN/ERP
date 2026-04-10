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

    // Fallback to Authorization header if cookie is not present
    if (!token) {
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1]
      }
    }

    if (!token) {
      logger.warn('인증 토큰이 누락되었습니다.')
      return res
        .status(SysConstants.HTTP_STATUS.UNAUTHORIZED)
        .json({ message: '인증 토큰이 필요합니다.' })
    }

    const secret = process.env.JWT_SECRET || 'your_fallback_secret_key_123'
    const decoded = jwt.verify(token, secret)

    // req 객체에 사용자 정보 주입
    req.user = decoded

    next()
  } catch (error) {
    logger.error('토큰 검증 오류: ' + error.message)
    return res
      .status(SysConstants.HTTP_STATUS.UNAUTHORIZED)
      .json({ message: '유효하지 않은 토큰입니다. 다시 로그인해주세요.' })
  }
}
