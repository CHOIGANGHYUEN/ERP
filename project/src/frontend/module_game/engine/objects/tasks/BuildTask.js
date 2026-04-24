import { BaseTask } from './BaseTask.js'

export class BuildTask extends BaseTask {
  constructor(targetBuilding) {
    super('BUILD')
    this.target = targetBuilding
    this.startTime = Date.now()
    this.stuckTimer = 0
    this.lastPos = { x: 0, y: 0 }
  }

  onEnter(creature, world) {
    if (!this.target || this.target.isDead) throw new Error('Building target missing')
    this.lastPos = { x: creature.x, y: creature.y }
  }

  onRunning(creature, deltaTime, world) {
    if (this.target.isConstructed) return 'COMPLETED'

    // 엣지 케이스 2: 갇힘 / 정체 체크
    if (creature.movement.isMoving) {
      const dx = creature.x - this.lastPos.x
      const dy = creature.y - this.lastPos.y
      if (Math.sqrt(dx * dx + dy * dy) < 0.1) {
        this.stuckTimer += deltaTime
        if (this.stuckTimer > 3000) { // 3초간 제자리
          console.warn(`[BuildTask] Stuck detected for ${creature.id}`)
          return 'FAILED'
        }
      } else {
        this.stuckTimer = 0
        this.lastPos = { x: creature.x, y: creature.y }
      }
    }

    // 전역 타임아웃
    if (Date.now() - this.startTime > 30000) return 'FAILED'

    const dist = creature.distanceTo(this.target)
    if (dist <= creature.size + (this.target.size || 20)) {
      creature.state = 'BUILDING'
      this.target.progress += deltaTime * 0.05
      
      if (this.target.progress >= (this.target.maxProgress || 100)) {
        return 'COMPLETED'
      }
    } else {
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
    }

    return 'RUNNING'
  }

  onComplete(creature, world) {
    if (this.target.isConstructed && this.target.village) {
      this.target.village.updateBuildingStatus(true)
    }
  }

  onFailed(creature, world, reason) {
    creature.state = 'IDLE'
    // 갇혔을 경우 블랙리스트에 추가하여 다른 작업 유도
    if (this.target && world.blacklistService) {
      world.blacklistService.add(this.target.id)
    }
  }
}
