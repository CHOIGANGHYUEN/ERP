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

      // 1. 클라이언트 토큰 복호화 또는 원본 그대로 사용 (Redirect 모드 지원)
      // 프론트엔드의 Popup 방식은 btoa로 감싸서 보내지만, Google Redirect 방식은 원본 JWT를 POST 합니다.
      // 원본 JWT는 '.'이 포함되어 있으므로 이를 기준으로 구분합니다.
      let credential
      if (encryptedCredential.includes('.')) {
        credential = encryptedCredential // 원본 JWT (Redirect Mode)
      } else {
        credential = decryptToken(encryptedCredential) // Base64 복호화 (Popup Mode)
      }

      // 2. 토큰 페이로드 디코딩 (서명 검증 전 자체 사전 체크용)
      const decoded = jwt.decode(credential)
      if (!decoded || !decoded.email) {
        return res.status(400).json({ message: 'Invalid token format.' })
      }

      const userId = decoded.email
      const now = new Date()

      // 💡 [버그수정 완료] DB 뷰어상 명확한 한국 시간(KST)을 기록하기 위함
      // 단순 new Date() + 9시간을 객체 그대로 쓰면 Node/Sequelize의 로컬 변환 규칙과 꼬여 에러를 유발합니다.
      // 강제 ISO 문자열 포맷(YYYY-MM-DD HH:mm:ss)로 박아서 저장하면 MySQL/MariaDB에 의도된 시간만 남습니다.
      const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const kstDateString = kstTime.toISOString().replace('T', ' ').substring(0, 19)

      const logData = {
        loginDt: kstDateString,
        userId: userId,
        loginAt: kstDateString,
        authorize: credential.substring(0, 255),
        createdBy: userId,
        changedBy: userId,
      }

      // 3. 토큰 유효 시간(만료) 사전 체크 로직
      const isExpired = decoded.exp * 1000 < now.getTime()
      if (isExpired) {
        res.clearCookie('token')
        await LogLoginUser.create({ ...logData, logged: 'FAIL: TOKEN_EXPIRED' })
        return res.status(401).json({ message: 'Token has expired.' })
      }

      // 4. 동시 로그인 방지/빠른 요청 차단 로직 (중복 DB 기록 방지)
      // 3초 이내의 동일 유저 로그인 요청은 중복 요청으로 간주하여 차단합니다.
      const lastLog = await LogLoginUser.findOne({
        where: { userId: userId },
        order: [['loginAt', 'DESC']],
      })

      if (lastLog) {
        // [타임존 호환성 방어] DB에서 꺼낸 loginAt이 '+09:00' 정보가 떨어져 나간 단순 문자열이라면,
        // Node 컨테이너(UTC) 환경에서는 이를 UTC 시간으로 잘못 파싱하여 미래 시간으로 착각할 수 있습니다.
        // 이를 막기 위해 파싱 시 KST 오프셋을 붙여서 절대 기준시(Epoch)를 동일하게 맞춥니다.
        let parsedLastLoginTime
        if (typeof lastLog.loginAt === 'string' && !lastLog.loginAt.includes('+')) {
          parsedLastLoginTime = new Date(lastLog.loginAt.trim() + '+09:00').getTime()
        } else {
          parsedLastLoginTime = new Date(lastLog.loginAt).getTime()
        }

        const timeDiff = now.getTime() - parsedLastLoginTime
        if (timeDiff < 1000) {
          // 중복 클릭이 감지되었을 때 에러 로그만 남기고 응답 종료
          console.warn(`[Auth] Blocked rapid login request for ${userId}. Time diff: ${timeDiff}ms`)
          return res.status(429).json({ message: '이미 로그인 처리가 진행 중입니다. 잠시만 기다려주세요.' })
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

      // 7. 시스템 보안 설정(sysConfig) - [Temporary Bypass]
      const timeoutMinutes = 60
      const expiresIn = `60m`
      const maxAge = 60 * 60 * 1000
      const allowMultiLogin = true
/*
      const timeoutConfig = await Config.findOne({
        where: { configId: 'SEC_SESSION_TIMEOUT', useYn: 1 },
      })
      const timeoutMinutes =
        timeoutConfig && timeoutConfig.configVal ? parseInt(timeoutConfig.configVal, 10) : 60
      const expiresIn = `${timeoutMinutes}m`
      const maxAge = timeoutMinutes * 60 * 1000

      const multiLoginConfig = await Config.findOne({
        where: { configId: 'SEC_ALLOW_MULTI_LOGIN', useYn: 1 },
      })
      const allowMultiLogin = true // [Temporary] 강제 허용 처리 (사용자 요청: 중복 로그인 차단 기능 비활성화)

      if (!allowMultiLogin) {
        const lastActivity = await LogLoginUser.findOne({
          where: { userId },
          order: [['loginAt', 'DESC']],
        })
        if (lastActivity && lastActivity.logged === 'SUCCESS: LOGIN_OK') {
          const timeDiff = now.getTime() - new Date(lastActivity.loginAt).getTime()
          if (timeDiff < maxAge) {
            await LogLoginUser.create({ ...logData, logged: 'BLOCKED: MULTI_LOGIN' })
            return res.status(403).json({
              message: '이미 다른 기기에서 로그인 중입니다. 중복 로그인이 차단되었습니다.',
            })
          }
        }
      }
*/

      const token = jwt.sign({ id: user.id, userId: user.userId, email: userId }, JWT_SECRET, {
        expiresIn,
      })

      // 8. 로그인 최종 성공 로그 저장
      await LogLoginUser.create({ ...logData, logged: 'SUCCESS: LOGIN_OK' })

      // 9. 쿠키 설정 및 응답 (path: '/' 설정을 통해 모든 API 경로에서 토큰 접근 가능하게 함)
      // localhost 개발 환경에서의 안정성을 위해 secure 및 sameSite 설정을 유연하게 가져갑니다.
      res.cookie('token', token, {
        httpOnly: true,
        secure: false, // 로컬 환경에서는 false로 고정하여 전송 보장
        sameSite: 'lax',
        maxAge,
        path: '/',
      })

      console.log(`User ${user.userId} logged in successfully via Google OAuth.`)

      // 10. 응답 방식 결정 (Redirect 여부 확인)
      // Google Redirect Mode는 요청 헤더의 Content-Type이 urlencoded 이거나 g_csrf_token 파라미터가 동반됨
      const isRedirect =
        req.headers['content-type'] === 'application/x-www-form-urlencoded' ||
        req.body.g_csrf_token

      if (isRedirect) {
        // 리다이렉트 모드일 경우 메인 대시보드로 이동
        return res.redirect('/')
      } else {
        // 기존 팝업 모드일 경우 JSON 응답
        return res.json({
          message: 'Login successful',
          user: { userId: user.userId, email, name, picture },
          token,
        })
      }
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
          const kstTime = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
          const kstDateString = kstTime.toISOString().replace('T', ' ').substring(0, 19)
          await LogLoginUser.create({
            loginDt: kstDateString,
            userId: decoded.email,
            loginAt: kstDateString,
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

  async getMe(req, res) {
    try {
      // verifyToken 미들웨어로부터 req.user(디코딩된 토큰)를 전달받음
      // 토큰에 담긴 DB 고유 ID(id)를 사용하여 사용자 정보를 조회합니다.
      const user = await userService.getUserDetail(req.user.id)
      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }
      res.json({
        user: {
          id: user.id,
          userId: user.userId,
          email: user.email || req.user.email,
          name: user.name,
          picture: user.picture,
        },
      })
    } catch (error) {
      console.error('getMe error:', error.message)
      res.status(500).json({ message: error.message })
    }
  },
}

export default authController
