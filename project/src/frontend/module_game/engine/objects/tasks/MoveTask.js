import { BaseTask } from './BaseTask.js'

export class MoveTask extends BaseTask {
  /**
   * @param {Object} target 이동할 목표 엔티티 (x, y와 size를 가짐)
   * @param {Number} threshold 도달했다고 판단할 거리
   */
  constructor(target, threshold = 10) {
    super('MOVE')
    this.target = target
    this.threshold = threshold
    this._startedAt = Date.now() // ⏱️ 타임아웃 감지용 시작 시간
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'

    // 1) 초기화 및 경로 탐색 (Enter)
    if (!creature.movement.isMoving && creature.movement.path.length === 0) {
      if (
        !this.target ||
        this.target.isDead ||
        this.target.x === undefined ||
        this.target.y === undefined
      ) {
        this.status = 'FAILED'
        return this.status
      }

      const path = world.pathfinderService.findPath(
        world, 
        creature.x, 
        creature.y, 
        this.target.x, 
        this.target.y
      )

      if (path === 'THROTTLED') {
        // [Throttle 방어] 연산 한도 도달 시 다음 틱을 기다림
        return 'RUNNING'
      }

      if (!path || path === 'FAILED' || (Array.isArray(path) && path.length === 0)) {
        this.status = 'FAILED'
        return this.status
      }

      creature.movement.path = path
      creature.movement.currentWaypointIndex = 0
      creature.movement.isMoving = true
      creature.state = 'MOVING'
    }

    // 2) 타임아웃 감시 (Running)
    if (Date.now() - this._startedAt > 20000) {
      this.status = 'FAILED'
      creature.movement.isMoving = false
      creature.movement.path = []
      return this.status
    }

    // 3) 성공 체크 (Completed)
    // MovementSystem이 성공적으로 도달하면 isMoving을 false로 바꿈
    if (!creature.movement.isMoving && creature.movement.path.length > 0) {
      const dist = creature.distanceTo({ x: this.target.x, y: this.target.y })
      if (dist <= this.threshold + (this.target.size || 0)) {
        this.status = 'COMPLETED'
        creature.movement.path = []
      } else {
        // 경로의 끝에 도달했는데 타겟과 멀다면 장애물 등으로 막힌 것임 (Failed)
        this.status = 'FAILED'
        creature.movement.path = []
      }
    }

    return this.status
  }
}
