import { BaseTask } from './BaseTask.js'

export class ExpansionTask extends BaseTask {
  constructor(homeVillage) {
    super('EXPANSION')
    this.name = '새로운 땅 개척 중'
    this.status = 'PENDING'
    this.homeVillage = homeVillage
    this.targetX = 0
    this.targetY = 0
    this.hasFoundSite = false
  }

  onEnter(creature, world) {
    // 💡 고향에서 멀리 떨어진 랜덤 좌표 설정 (800~1500px)
    const angle = Math.random() * Math.PI * 2
    const dist = 800 + Math.random() * 700
    this.targetX = Math.max(100, Math.min(world.width - 100, creature.x + Math.cos(angle) * dist))
    this.targetY = Math.max(100, Math.min(world.height - 100, creature.y + Math.sin(angle) * dist))
    this.status = 'RUNNING'
  }

  onRunning(creature, deltaTime, world) {
    const distToTarget = creature.distanceTo({ x: this.targetX, y: this.targetY })

    if (!this.hasFoundSite) {
      if (distToTarget < 20) {
        // 💡 [최적화] 부지 적합성 검사 빈도 조절 (0.5초당 1회)
        this._checkTimer = (this._checkTimer || 0) + deltaTime
        if (this._checkTimer < 500) return 'RUNNING'
        this._checkTimer = 0

        if (this._isValidSite(world, this.targetX, this.targetY)) {
          this.hasFoundSite = true
          this._foundVillage(creature, world)
          return 'COMPLETED'
        } else {
          // 다시 탐색
          this.onEnter(creature, world)
        }
      } else {
        creature.moveToTarget(this.targetX, this.targetY, deltaTime, world)
        creature.state = 'MOVING'
      }
    }

    return 'RUNNING'
  }

  _isValidSite(world, x, y) {
    // 1. 지형 체크 (바다 2, 3 제외)
    if (world.terrain) {
      const tx = Math.floor(x / 16), ty = Math.floor(y / 16)
      const cols = Math.ceil(world.width / 16)
      const terrain = world.terrain[ty * cols + tx]
      if (terrain === 2 || terrain === 3) return false
    }
    // 2. 주변 건물 체크
    const nearby = world.buildings.some(b => {
      const dx = b.x - x, dy = b.y - y
      return Math.sqrt(dx * dx + dy * dy) < 200
    })
    return !nearby
  }

  _foundVillage(creature, world) {
    const villageSystem = world.villageSystem
    if (villageSystem) {
      const newVillage = villageSystem.createVillage(world, creature.x, creature.y, creature)
      world.broadcastEvent(`🎊 개척자 ${creature.id}이(가) 새로운 터전 [${newVillage.name}]을 세웠습니다!`, '#2ecc71')
    }
  }

  onComplete(creature, world) {
    creature.state = 'IDLE'
  }
}
