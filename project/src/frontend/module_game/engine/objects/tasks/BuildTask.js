import { BaseTask } from './BaseTask.js'
import { MoveTask } from './MoveTask.js'

export class BuildTask extends BaseTask {
  constructor(targetBuilding) {
    super('BUILD')
    this.name = '건설 중'
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
      this._outOfRangeTimer = 0 // 거리 내에 있으면 타이머 초기화

      const speed = 0.08 * (creature.workEfficiency || 1.0)
      this.target.progress += deltaTime * speed
      
      if (this.target.progress >= (this.target.maxProgress || 100)) {
        this.target.progress = this.target.maxProgress 
        this.target.isConstructed = true
        return 'COMPLETED'
      }
    } else {
      // 💡 [유지력 강화] 거리가 멀어졌다고 바로 FAILED 하지 않고 3초간 기회를 줌
      this._outOfRangeTimer = (this._outOfRangeTimer || 0) + deltaTime
      if (this._outOfRangeTimer > 3000) return 'FAILED'
      
      // 다시 다가가도록 유도
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
      return 'RUNNING'
    }

    return 'RUNNING'
  }

  onComplete(creature, world) {
    if (this.target) {
      this.target.isTargeted = false
      if (this.target.village) {
        this.target.village.updateBuildingStatus(true)
        // 💡 [버그 수정] 게시판 등록 ID와 형식을 맞춤 (build-{id})
        if (world.taskBoardService) {
          const vIdx = world.villages.indexOf(this.target.village)
          world.taskBoardService.completeTask(vIdx, `build-${this.target.id}`)
        }
      }
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
