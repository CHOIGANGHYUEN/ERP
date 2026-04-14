export class DIContainer {
  constructor() {
    this.dependencies = new Map()
  }

  /**
   * 의존성을 컨테이너에 등록합니다.
   * @param {Symbol|String} token - 의존성 식별자
   * @param {Class} implementation - 구현체 클래스
   * @param {Object} options - 설정 (기본값: singleton 패턴 사용)
   */
  register(token, implementation, options = { singleton: true }) {
    this.dependencies.set(token, {
      implementation,
      singleton: options.singleton,
      instance: null,
    })
  }

  /**
   * 등록된 토큰을 통해 의존성 인스턴스를 주입받습니다.
   * @param {Symbol|String} token
   * @param {...any} args - 생성자에 전달할 추가 인자들
   * @returns {Object} 구현체 인스턴스
   */
  resolve(token, ...args) {
    if (!this.dependencies.has(token)) {
      throw new Error(`[DI Error] Dependency not found for token: ${token.toString()}`)
    }

    const dep = this.dependencies.get(token)

    if (dep.singleton) {
      if (!dep.instance) {
        dep.instance = new dep.implementation(...args)
      }
      return dep.instance
    }

    return new dep.implementation(...args)
  }
}
