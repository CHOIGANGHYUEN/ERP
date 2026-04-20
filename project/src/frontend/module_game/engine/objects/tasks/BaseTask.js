export class BaseTask {
  constructor(type) {
    this.type = type
    this.status = 'PENDING' // 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
  }

  // 상속하여 구현. 실행 결과를 this.status에 업데이트 후 반환
  execute(creature, deltaTime, world) {
    return this.status
  }

  // 💡 [추가] 자식 클래스의 execute 실행 시 에러를 방어하는 래퍼 메서드
  safeExecute(creature, deltaTime, world) {
    try {
      return this.execute(creature, deltaTime, world)
    } catch (e) {
      console.error(
        `[Task Error] ${this.type} Task 실행 중 오류 (Creature ID: ${creature?.id}):`,
        e,
      )
      this.status = 'FAILED'
      return this.status
    }
  }
}
