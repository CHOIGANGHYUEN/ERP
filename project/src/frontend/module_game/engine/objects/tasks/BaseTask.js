export class BaseTask {
  constructor(type) {
    this.type = type
    this.status = 'PENDING'
    this._initialized = false
  }

  // ■ 라이프사이클 훅 (자식 클래스에서 오버라이드)
  onEnter(creature, world) {}
  onRunning(creature, deltaTime, world) { return 'RUNNING' }
  onComplete(creature, world) {}
  onFailed(creature, world, reason) {}

  /**
   * ECS/FSM 통합 실행 메서드
   */
  execute(creature, deltaTime, world) {
    if (this.status === 'COMPLETED' || this.status === 'FAILED') return this.status

    try {
      // 1. 진입 (Enter)
      if (!this._initialized) {
        this.onEnter(creature, world)
        this._initialized = true
        this.status = 'RUNNING'
      }

      // 2. 실행 (Running)
      const result = this.onRunning(creature, deltaTime, world)
      this.status = result || 'RUNNING'

      // 3. 완료 처리
      if (this.status === 'COMPLETED') {
        this.onComplete(creature, world)
      }

      return this.status
    } catch (e) {
      console.error(`[Task Fatal Error] ${this.type}`, e)
      return this.fail(creature, world, e.message)
    }
  }

  fail(creature, world, reason) {
    this.status = 'FAILED'
    this.onFailed(creature, world, reason)
    return 'FAILED'
  }
}
