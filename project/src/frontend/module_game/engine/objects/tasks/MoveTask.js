import { BaseTask } from './BaseTask.js'

export class MoveTask extends BaseTask {
  constructor(target, threshold = 10) {
    super('MOVE')
    this.target = target
    this.threshold = threshold
    this.startTime = Date.now()
  }

  onEnter(creature, world) {
    if (!this.target || this.target.x === undefined) throw new Error('Invalid movement target')
    
    // 타겟 지향 렌더링을 위해 타겟 설정
    creature.target = this.target
    
    const path = world.pathfinderService.findPath(
      world, creature.x, creature.y, this.target.x, this.target.y
    )

    if (!path || path === 'FAILED' || (Array.isArray(path) && path.length === 0)) {
      throw new Error('Pathfinding failed')
    }

    if (path === 'THROTTLED') {
      this._initialized = false // 다음 틱에 다시 onEnter 시도
      return
    }

    creature.movement.path = path
    creature.movement.currentWaypointIndex = 0
    creature.movement.isMoving = true
    creature.state = 'MOVING' // 적극적인 이동 상태로 변경
  }

  onRunning(creature, deltaTime, world) {
    // 타임아웃 20초
    if (Date.now() - this.startTime > 20000) return 'FAILED'

    // 도달 체크 (MovementSystem이 isMoving을 false로 만들었을 때)
    if (!creature.movement.isMoving) {
      const dist = creature.distanceTo(this.target)
      const range = this.threshold + (this.target.size || 0)
      return (dist <= range) ? 'COMPLETED' : 'FAILED'
    }

    return 'RUNNING'
  }

  onFailed(creature, world, reason) {
    creature.movement.isMoving = false
    creature.movement.path = []
    creature.target = null
  }
}
