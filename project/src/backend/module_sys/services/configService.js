import { Config } from '../models/index.js'
import { Op } from 'sequelize'

const mockConfigs = [
  // 1. SYSTEM
  {
    langu: 'KO',
    configId: 'SYSTEM',
    configNm: '시스템 기본 설정',
    configLevel: 1,
    ordNum: 10,
    parentConfigId: null,
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SYS_TITLE',
    configNm: '시스템 명칭',
    configLevel: 2,
    ordNum: 1,
    parentConfigId: 'SYSTEM',
    configVal: 'ERP System',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SYS_COMPANY',
    configNm: '운영 회사명',
    configLevel: 2,
    ordNum: 2,
    parentConfigId: 'SYSTEM',
    configVal: '주식회사 데모',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SYS_LANG',
    configNm: '기본 언어',
    configLevel: 2,
    ordNum: 3,
    parentConfigId: 'SYSTEM',
    configVal: 'KO',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SYS_TIMEZONE',
    configNm: '기본 타임존',
    configLevel: 2,
    ordNum: 4,
    parentConfigId: 'SYSTEM',
    configVal: 'Asia/Seoul',
    useYn: 1,
  },
  // 2. THEME
  {
    langu: 'KO',
    configId: 'THEME',
    configNm: '화면 테마 설정',
    configLevel: 1,
    ordNum: 20,
    parentConfigId: null,
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'THEME_MODE',
    configNm: '기본 화면 모드',
    configLevel: 2,
    ordNum: 1,
    parentConfigId: 'THEME',
    configVal: 'light',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'THEME_COLOR',
    configNm: '기본 포인트 색상',
    configLevel: 2,
    ordNum: 2,
    parentConfigId: 'THEME',
    configVal: 'blue',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'THEME_FONT_SIZE',
    configNm: '기본 폰트 크기',
    configLevel: 2,
    ordNum: 3,
    parentConfigId: 'THEME',
    configVal: '14px',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'THEME_SIDEBAR',
    configNm: '사이드바 기본 상태',
    configLevel: 2,
    ordNum: 4,
    parentConfigId: 'THEME',
    configVal: 'expanded',
    useYn: 1,
  },
  // 3. SECURITY
  {
    langu: 'KO',
    configId: 'SECURITY',
    configNm: '보안 및 계정 설정',
    configLevel: 1,
    ordNum: 30,
    parentConfigId: null,
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SEC_SESSION_TIMEOUT',
    configNm: '세션 만료 시간(분)',
    configLevel: 2,
    ordNum: 1,
    parentConfigId: 'SECURITY',
    configVal: '60',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SEC_MAX_LOGIN_FAIL',
    configNm: '최대 로그인 실패 횟수',
    configLevel: 2,
    ordNum: 2,
    parentConfigId: 'SECURITY',
    configVal: '5',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SEC_PW_EXPIRY_DAYS',
    configNm: '비밀번호 변경 주기(일)',
    configLevel: 2,
    ordNum: 3,
    parentConfigId: 'SECURITY',
    configVal: '90',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'SEC_ALLOW_MULTI_LOGIN',
    configNm: '중복 로그인 허용 여부',
    configLevel: 2,
    ordNum: 4,
    parentConfigId: 'SECURITY',
    configVal: 'N',
    useYn: 1,
  },
  // 4. FORMAT
  {
    langu: 'KO',
    configId: 'FORMAT',
    configNm: '데이터 출력 포맷',
    configLevel: 1,
    ordNum: 40,
    parentConfigId: null,
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'FMT_DATE',
    configNm: '기본 날짜 포맷',
    configLevel: 2,
    ordNum: 1,
    parentConfigId: 'FORMAT',
    configVal: 'YYYY-MM-DD',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'FMT_DATETIME',
    configNm: '기본 일시 포맷',
    configLevel: 2,
    ordNum: 2,
    parentConfigId: 'FORMAT',
    configVal: 'YYYY/MM/DD HH:mm:ss',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'FMT_CURRENCY',
    configNm: '기본 통화 코드',
    configLevel: 2,
    ordNum: 3,
    parentConfigId: 'FORMAT',
    configVal: 'KRW',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'FMT_AMT_ROUNDING',
    configNm: '금액 소수점 처리',
    configLevel: 2,
    ordNum: 4,
    parentConfigId: 'FORMAT',
    configVal: '0',
    useYn: 1,
  },
  // 5. MODULE
  {
    langu: 'KO',
    configId: 'MODULE',
    configNm: 'ERP 모듈 사용 설정',
    configLevel: 1,
    ordNum: 50,
    parentConfigId: null,
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'MOD_SYS',
    configNm: '시스템(SYS) 사용여부',
    configLevel: 2,
    ordNum: 1,
    parentConfigId: 'MODULE',
    configVal: 'Y',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'MOD_FI',
    configNm: '재무/회계(FI) 사용여부',
    configLevel: 2,
    ordNum: 2,
    parentConfigId: 'MODULE',
    configVal: 'Y',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'MOD_HR',
    configNm: '인사/급여(HR) 사용여부',
    configLevel: 2,
    ordNum: 3,
    parentConfigId: 'MODULE',
    configVal: 'Y',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'MOD_MM',
    configNm: '자재/구매(MM) 사용여부',
    configLevel: 2,
    ordNum: 4,
    parentConfigId: 'MODULE',
    configVal: 'Y',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'MOD_SD',
    configNm: '영업/판매(SD) 사용여부',
    configLevel: 2,
    ordNum: 5,
    parentConfigId: 'MODULE',
    configVal: 'N',
    useYn: 1,
  },
  // 6. NOTI
  {
    langu: 'KO',
    configId: 'NOTI',
    configNm: '알림 및 외부 연동',
    configLevel: 1,
    ordNum: 60,
    parentConfigId: null,
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'NOTI_EMAIL_USE',
    configNm: '이메일 발송 사용여부',
    configLevel: 2,
    ordNum: 1,
    parentConfigId: 'NOTI',
    configVal: 'Y',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'NOTI_SMTP_SERVER',
    configNm: 'SMTP 서버 주소',
    configLevel: 2,
    ordNum: 2,
    parentConfigId: 'NOTI',
    configVal: 'smtp.gmail.com',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'NOTI_SMTP_PORT',
    configNm: 'SMTP 서버 포트',
    configLevel: 2,
    ordNum: 3,
    parentConfigId: 'NOTI',
    configVal: '587',
    useYn: 1,
  },
  {
    langu: 'KO',
    configId: 'NOTI_SMS_USE',
    configNm: 'SMS 발송 사용여부',
    configLevel: 2,
    ordNum: 4,
    parentConfigId: 'NOTI',
    configVal: 'N',
    useYn: 1,
  },
]

const configService = {
  // 초기 기본 데이터 보완 메서드 (DB에 없는 항목만 삽입, 기존 커스터마이즈 값은 보존)
  async initializeDefaultConfigs() {
    let insertedCount = 0
    for (const cfg of mockConfigs) {
      const existing = await Config.findOne({
        where: { langu: cfg.langu, configId: cfg.configId },
      })
      if (!existing) {
        await Config.create({ ...cfg, createdBy: 'system', changedBy: 'system' })
        insertedCount++
      }
    }
    if (insertedCount > 0) {
      console.log(`✅ 기본 시스템 설정(sysConfig) ${insertedCount}건이 초기화되었습니다.`)
    }
  },

  async getAllConfigs(page = 1, limit = 10, search = '') {
    // initializeDefaultConfigs는 서버 시작 시 server.js에서 호출됨 (중복 호출 방지)

    const totalInDb = await Config.count()
    if (totalInDb === 0) {
      // 서버 시작 시 초기화가 완료되지 않은 경우 fallback (비정상 상황)
      return { data: mockConfigs, total: mockConfigs.length, page: 1, limit: mockConfigs.length }
    }

    const where = {}
    if (search) {
      where[Op.or] = [
        { configId: { [Op.like]: `%${search}%` } },
        { configNm: { [Op.like]: `%${search}%` } },
      ]
    }

    // Tree 구조에서는 페이징이 무의미하므로, 검색 조건에 맞는 모든 데이터를 반환합니다.
    const rows = await Config.findAll({
      where,
      order: [
        ['configLevel', 'ASC'],
        ['ordNum', 'ASC'],
      ],
    })

    return {
      data: rows,
      total: rows.length,
      page: 1,
      limit: rows.length,
    }
  },

  async getConfigById(id) {
    // 신규 생성 요청 시 DB 조회 오류 방지 (즉시 기본값 반환)
    if (id === 'new') {
      return { langu: 'KO', configLevel: 1, ordNum: 99, useYn: 1 }
    }

    const config = await Config.findByPk(id)
    if (!config) {
      throw new Error('설정을 찾을 수 없습니다.')
    }
    return config
  },

  async createConfig(data, userId) {
    const { langu = 'KO', configId } = data
    const existing = await Config.findOne({ where: { langu, configId } })
    if (existing) throw new Error('이미 존재하는 설정 ID입니다.')

    if (data.parentConfigId === '') data.parentConfigId = null

    return await Config.create({ ...data, langu, createdBy: userId, changedBy: userId })
  },

  async updateConfig(id, data, userId) {
    const config = await Config.findByPk(id)
    if (!config) throw new Error('설정을 찾을 수 없습니다.')

    // Prevent changing unique key
    if (data.configId && data.configId !== config.configId) {
      const existing = await Config.findOne({
        where: { langu: data.langu || config.langu, configId: data.configId },
      })
      if (existing) {
        throw new Error('이미 존재하는 설정 ID입니다.')
      }
    }

    if (data.parentConfigId === '') data.parentConfigId = null

    await config.update({ ...data, changedBy: userId })
    return config
  },

  async deleteConfig(id) {
    const config = await Config.findByPk(id)
    if (!config) throw new Error('설정을 찾을 수 없습니다.')

    // 하위 설정이 있는지 확인
    const children = await Config.count({
      where: { parentConfigId: config.configId, langu: config.langu },
    })
    if (children > 0) {
      throw new Error('하위 설정이 존재하여 삭제할 수 없습니다. 하위 설정을 먼저 삭제해주세요.')
    }

    await config.destroy()
    return { success: true }
  },
}

export default configService
