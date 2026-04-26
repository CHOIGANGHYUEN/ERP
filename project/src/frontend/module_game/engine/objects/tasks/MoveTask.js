import { BaseTask } from './BaseTask.js'
import { findPath, PATH_THROTTLED } from '../../systems/PathSystem.js'
import { TERRAIN_COST } from '../../systems/TerrainSystem.js'

export class MoveTask extends BaseTask {
  constructor(target, threshold = 10) {
    super('MOVE')
    this.target = target
    this.threshold = threshold
    this.startTime = Date.now()
    this.lastX = 0
    this.lastY = 0
    this.stuckTimer = 0
  }

  onEnter(creature, world) {
    if (!this.target || this.target.x === undefined) throw new Error('Invalid movement target')
    
    creature.target = this.target
    const path = findPath(world, { x: creature.x, y: creature.y }, this.target)

    if (path === PATH_THROTTLED) {
      this._initialized = false
      return
    }

    if (!path) {
      creature.state = 'IDLE'
      this.status = 'FAILED'
      return
    }

    if (Array.isArray(path) && path.length === 0) {
      this.status = 'COMPLETED'
      return
    }

    this.path = path
    creature.movement.path = this.path
    creature.movement.currentWaypointIndex = 0
    creature.movement.isMoving = true
    creature.state = 'MOVING'
  }

  onRunning(creature, deltaTime, world) {
    if (Date.now() - this.startTime > 30000) { // 타임아웃 30초로 상향
      return 'FAILED'
    }

    // 💡 [동적 타겟 추적] 타겟이 움직이는 개체인 경우 최신 좌표를 동기화
    if (this.target && typeof this.target === 'object' && this.target.x !== undefined) {
      if (creature.movement.isMoving) {
        const lastTargetX = creature.movement.path[creature.movement.path.length - 1]?.x
        const lastTargetY = creature.movement.path[creature.movement.path.length - 1]?.y
        
        // 타겟이 기존 최종 목적지에서 16px 이상 벗어나면 경로 재갱신
        if (Math.abs(this.target.x - lastTargetX) > 16 || Math.abs(this.target.y - lastTargetY) > 16) {
           const newPath = findPath(world, { x: creature.x, y: creature.y }, this.target)
           if (newPath && newPath !== PATH_THROTTLED) {
             creature.movement.path = newPath
             creature.movement.currentWaypointIndex = 0
           }
        }
      }
    }

    // 💡 [도달 판합] MovementSystem이 경로를 다 소화했거나 멈췄을 때
    if (!creature.movement.isMoving) {
      const dist = creature.distanceTo(this.target)
      return (dist <= this.threshold + 5) ? 'COMPLETED' : 'FAILED'
    }

    // Stuck Detection
    const curX = Math.round(creature.x)
    const curY = Math.round(creature.y)
    if (curX === this.lastX && curY === this.lastY) {
      this.stuckTimer += deltaTime
    } else {
      this.stuckTimer = 0
      this.lastX = curX
      this.lastY = curY
    }

    // 1.5초 이상 멈춰있으면 경로 재탐색 시도
    if (this.stuckTimer > 1500) {
      this.stuckTimer = 0
      const newPath = findPath(world, { x: creature.x, y: creature.y }, this.target)
      
      if (newPath === PATH_THROTTLED) return 'RUNNING'
      if (!newPath || newPath.length === 0) return 'FAILED'
      
      this.path = newPath
      creature.movement.path = this.path
      creature.movement.currentWaypointIndex = 0
    }

    return 'RUNNING'
  }

  onFailed(creature, world, reason) {
    creature.movement.isMoving = false
    creature.movement.path = []
    this.path = []
    creature.target = null
  }
}
