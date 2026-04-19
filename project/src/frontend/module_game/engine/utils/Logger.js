/**
 * 통합 로깅 시스템 (Logger)
 * 메인 스레드와 워커 스레드 모두에서 사용 가능하며, 
 * 워커에서 발생한 에러를 메인 스레드로 전파하는 기능을 지원합니다.
 */
export class Logger {
  static LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  }

  static currentLevel = Logger.LEVELS.INFO
  static onWorkerError = null // 워커 환경에서 메인 스레드로 메시지를 쏘는 콜백

  static debug(tag, message, ...args) {
    if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
      console.debug(`[${tag}] 🔍`, message, ...args)
    }
  }

  static info(tag, message, ...args) {
    if (Logger.currentLevel <= Logger.LEVELS.INFO) {
      console.log(`%c[${tag}] ℹ️`, 'color: #3498db; font-weight: bold;', message, ...args)
    }
  }

  static warn(tag, message, ...args) {
    if (Logger.currentLevel <= Logger.LEVELS.WARN) {
      console.warn(`[${tag}] ⚠️`, message, ...args)
    }
  }

  static error(tag, message, ...args) {
    if (Logger.currentLevel <= Logger.LEVELS.ERROR) {
      const errorMsg = `[${tag}] ❌ ${message}`
      console.error(errorMsg, ...args)

      // 워커 환경이고 콜백이 등록되어 있다면 메인 스레드로 에러 전파
      if (Logger.onWorkerError) {
        Logger.onWorkerError({
          type: 'ERROR_LOG',
          payload: {
            tag,
            message: message.toString(),
            stack: args[0] instanceof Error ? args[0].stack : new Error().stack,
            time: new Date().toLocaleTimeString()
          }
        })
      }
    }
  }
}
