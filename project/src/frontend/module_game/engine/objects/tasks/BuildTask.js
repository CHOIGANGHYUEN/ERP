import { BaseTask } from './BaseTask.js'
import { MoveTask } from './MoveTask.js'

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
    creature.target = this.target
    this.target.isTargeted = true
    this.lastPos = { x: creature.x, y: creature.y }
  }

  onRunning(creature, deltaTime, world) {
    if (this.target.isConstructed) return 'COMPLETED'
    if (this.target.isDead) return 'FAILED'

    // 1) 갇힘 / 정체 체크 - 8초로 상향 (군집 이동 시의 약간의 병목 허용)
    const dx = creature.x - this.lastPos.x
    const dy = creature.y - this.lastPos.y
    if (Math.sqrt(dx * dx + dy * dy) < 0.1) {
      this.stuckTimer += deltaTime
      if (this.stuckTimer > 8000) return 'FAILED'
    } else {
      this.stuckTimer = 0
      this.lastPos = { x: creature.x, y: creature.y }
    }

    // 2) 전역 타임아웃 상향 (대규모 건축물 대응)
    if (Date.now() - this.startTime > 300000) return 'FAILED'

    // 3) 거리 체크 및 행동 수행 (넉넉한 인터랙션 거리 부여)
    const dist = creature.distanceTo(this.target)
    const buildRange = creature.size + (this.target.size || 20) + 15

    if (dist <= buildRange) {
      creature.state = 'BUILDING'
      // 건축 속도: 크리처 효율성 반영
      const speed = 0.05 * (creature.workEfficiency || 1.0)
      this.target.progress += deltaTime * speed
      
      if (this.target.progress >= (this.target.maxProgress || 100)) {
        this.target.isConstructed = true
        return 'COMPLETED'
      }
    } else {
      // 💡 [건축 집중력] 거리가 멀어지면 FAILED를 즉시 뱉지 않고 
      // 잠시 기다리거나 MoveTask로 다시 돌아가도록 유도 (WorkSystem에서 보완)
      return 'FAILED'
    }

    return 'RUNNING'
  }

  onComplete(creature, world) {
    if (this.target) {
      this.target.isTargeted = false
      if (this.target.village) this.target.village.updateBuildingStatus(true)
      world.broadcastEvent(`🏗️ ${this.target.type} 건설 완료!`, '#2ecc71')
    }
    creature.target = null
  }

  onFailed(creature, world, reason) {
    if (this.target) this.target.isTargeted = false
    creature.state = 'IDLE'
    creature.target = null
  }
}
