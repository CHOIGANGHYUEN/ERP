export class BaseTask {
  constructor(type) {
    this.type = type
    this.status = 'PENDING' // 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
  }

  // 상속하여 구현. 실행 결과를 this.status에 업데이트 후 반환
  execute(creature, deltaTime, world) {
    return this.status
  }
}
