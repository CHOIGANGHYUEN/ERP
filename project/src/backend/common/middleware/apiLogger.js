import { LogUser } from '../../module_sys/models/index.js'

export const apiLogger = (req, res, next) => {
  // 요청 처리가 모두 끝나고 클라이언트에게 응답을 보낼 때(finish) 로그를 기록합니다.
  // 이를 통해 인증 미들웨어(verifyToken)가 셋팅한 req.user 값과 최종 HTTP 상태 코드를 확보할 수 있습니다.
  res.on('finish', async () => {
    try {
      // API 요청만 로깅 (정적 파일 등은 제외)
      if (!req.originalUrl.startsWith('/api/')) return

      const now = new Date()
      // 로그인이 필요 없는 API(예: 로그인 시도 자체)이거나 인증 실패 시 'anonymous'로 기록
      const userId = req.user?.userId || 'anonymous'

      // 파라미터(query, body) 병합 및 민감 정보 마스킹
      const paramsObj = { ...req.query, ...req.body }
      if (paramsObj.credential) paramsObj.credential = '********'
      if (paramsObj.password) paramsObj.password = '********'

      const paramsStr = JSON.stringify(paramsObj).substring(0, 255)
      // request 컬럼에 메서드가 들어가므로 logged 에서는 URL과 상태코드만 남깁니다.
      const loggedMsg = `${req.originalUrl} (Status: ${res.statusCode})`

      // 프론트엔드 헤더에서 메뉴 ID 추출 (없으면 URL 기반 추정 또는 빈 값)
      const menuId = req.headers['x-menu-id'] || req.headers['menu-id'] || ''

      await LogUser.create({
        logDt: now,
        userId: userId,
        menuId: menuId,
        logAt: now,
        logged: loggedMsg,
        params: paramsStr,
        request: req.method, // 의도하신 대로 GET, POST, PUT, DELETE 등을 저장합니다.
        createdBy: userId,
        changedBy: userId,
      })
    } catch (error) {
      console.error('Global API Logging Error:', error)
    }
  })

  next()
}
