import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import userService from '../services/userService.js'
import process from 'node:process'
import { LogLoginUser, Config } from '../models/index.js'

// process.env.VITE_GOOGLE_CLIENT_ID will be loaded via dotenv in server.js
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key_123'

// 환경 변수(.env) 설정에 따라 유연하게 암호화/복호화 방식을 결정하는 유틸리티 함수
const decryptToken = (encryptedToken) => {
  // 프론트엔드에서 기본적으로 btoa(Base64)를 사용하도록 변경했으므로 기본값을 BASE64로 맞춥니다.
  const rule = process.env.TOKEN_ENCRYPTION_RULE || 'BASE64'
  try {
    if (rule === 'NONE') return encryptedToken
    if (rule === 'BASE64') return Buffer.from(encryptedToken, 'base64').toString('utf8')
    // 향후 AES-256 등 추가 암호화 방식이 확정되면 이곳에 로직을 추가합니다.
    return encryptedToken
  } catch (_e) {
    throw new Error('Token decryption failed')
  }
}

const authController = {
  async googleLogin(req, res) {
    try {
      const { credential: encryptedCredential } = req.body
      if (!encryptedCredential) {
        return res.status(400).json({ message: 'Missing credential.' })
      }

      // 1. 클라이언트 토큰 복호화 (유연한 암호화 규칙 적용)
      const credential = decryptToken(encryptedCredential)

      // 2. 토큰 페이로드 디코딩 (서명 검증 전 자체 사전 체크용)
      const decoded = jwt.decode(credential)
      if (!decoded || !decoded.email) {
        return res.status(400).json({ message: 'Invalid token format.' })
      }

      const userId = decoded.email
      const now = new Date()

      // 로그 저장을 위한 공통 데이터 셋
      const logData = {
        loginDt: now, // DB의 DATE 타입에 맞게 Sequelize가 변환
        userId: userId,
        loginAt: now,
        authorize: credential.substring(0, 255), // 인증값의 길이를 맞춰 저장
        createdBy: userId,
        changedBy: userId,
      }

      // 3. 토큰 유효 시간(만료) 사전 체크 로직
      // 구글의 최종 검증을 타기 전에, 이미 토큰이 만료되었다면 튕겨내고 클라이언트를 로그아웃 처리합니다.
      const isExpired = decoded.exp * 1000 < now.getTime()
      if (isExpired) {
        res.clearCookie('token') // 토큰 파괴 (로그아웃)
        await LogLoginUser.create({ ...logData, logged: 'FAIL: TOKEN_EXPIRED' }) // 만료도 로그 남김
        return res.status(401).json({ message: 'Token has expired.' })
      }

      // 4. 동시 로그인(1초 미만 간격) 봇/중복 요청 방지 로직
      const lastLog = await LogLoginUser.findOne({
        where: { userId: userId },
        order: [['loginAt', 'DESC']],
      })

      if (lastLog) {
        const timeDiff = now.getTime() - new Date(lastLog.loginAt).getTime()
        if (timeDiff < 1000) {
          // 1초(1000ms) 이내의 요청일 경우 차단
          await LogLoginUser.create({ ...logData, logged: 'BLOCKED: RAPID_REQUESTS' }) // 차단된 것도 로그 남김
          return res.status(429).json({ message: 'Too many login attempts. Please wait a moment.' })
        }
      }

      // 5. 구글 인증 라이브러리를 통한 최종 유효성 및 서명 검증
      const client = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID)
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.VITE_GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()
      const { sub: googleId, email, name, picture } = payload

      // 6. DB 유저 확인 또는 신규 가입
      const user = await userService.findOrCreateUser({ googleId, email, name, picture })

      // 7. 시스템 보안 설정(sysConfig) 동적 적용
      // 보안규칙 1: 세션 만료 시간 (SEC_SESSION_TIMEOUT) 적용
      const timeoutConfig = await Config.findOne({
        where: { configId: 'SEC_SESSION_TIMEOUT', useYn: 1 },
      })
      const timeoutMinutes =
        timeoutConfig && timeoutConfig.configVal ? parseInt(timeoutConfig.configVal, 10) : 60
      const expiresIn = `${timeoutMinutes}m`
      const maxAge = timeoutMinutes * 60 * 1000

      // 보안규칙 2: 중복 로그인 허용 여부 (SEC_ALLOW_MULTI_LOGIN) 검사 및 차단
      const multiLoginConfig = await Config.findOne({
        where: { configId: 'SEC_ALLOW_MULTI_LOGIN', useYn: 1 },
      })
      const allowMultiLogin = multiLoginConfig && multiLoginConfig.configVal === 'Y'

      if (!allowMultiLogin) {
        const lastActivity = await LogLoginUser.findOne({
          where: { userId },
          order: [['loginAt', 'DESC']],
        })
        // 마지막 이력이 로그인 성공이고, 아직 세션 만료 시간 이내라면 (로그아웃 안 함)
        if (lastActivity && lastActivity.logged === 'SUCCESS: LOGIN_OK') {
          const timeDiff = now.getTime() - new Date(lastActivity.loginAt).getTime()
          if (timeDiff < maxAge) {
            await LogLoginUser.create({ ...logData, logged: 'BLOCKED: MULTI_LOGIN' })
            return res
              .status(403)
              .json({
                message: '이미 다른 기기에서 로그인 중입니다. 중복 로그인이 차단되었습니다.',
              })
          }
        }
      }

      const token = jwt.sign({ id: user.id, userId: user.userId, email: userId }, JWT_SECRET, {
        expiresIn,
      })

      // 8. 로그인 최종 성공 로그 저장
      await LogLoginUser.create({ ...logData, logged: 'SUCCESS: LOGIN_OK' })

      // 9. 쿠키 설정 및 응답
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
      })

      console.log(`User ${user.userId} logged in successfully via Google OAuth.`)
      res.json({
        message: 'Login successful',
        user: { userId: user.userId, email, name, picture },
        token,
      })
    } catch (error) {
      console.error('Google login error: ' + error.message)
      res.status(401).json({ message: 'Authentication failed', error: error.message })
    }
  },

  async logout(req, res) {
    // 로그아웃 시에도 이력을 남겨야 중복 로그인 차단(SEC_ALLOW_MULTI_LOGIN) 로직이 정상 작동합니다.
    try {
      const token = req.cookies.token
      if (token) {
        const decoded = jwt.decode(token)
        if (decoded && decoded.email) {
          await LogLoginUser.create({
            loginDt: new Date(),
            userId: decoded.email,
            loginAt: new Date(),
            authorize: 'LOGOUT',
            logged: 'SUCCESS: LOGOUT',
            createdBy: decoded.email,
            changedBy: decoded.email,
          })
        }
      }
    } catch (e) {
      console.error('Logout logging error:', e)
    }

    res.clearCookie('token')
    res.json({ message: 'Logged out successfully' })
  },
}

export default authController
