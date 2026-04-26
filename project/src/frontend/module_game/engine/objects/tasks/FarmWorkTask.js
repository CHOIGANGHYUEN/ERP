import { BaseTask } from './BaseTask.js'
import { MoveTask } from './MoveTask.js'

export class FarmWorkTask extends BaseTask {
  constructor(targetFarm) {
    super('FARMING')
    this.name = '농사 중'
    this.target = targetFarm
    this.currentTile = null
    this.workTimer = 0
    this.workPhase = 'SCANNING' // SCANNING, MOVING, WORKING
  }

  onEnter(creature, world) {
    if (!this.target || this.target.type !== 'FARM') throw new Error('Invalid Farm target')
    creature.target = this.target
  }

  onRunning(creature, deltaTime, world) {
    if (this.target.isDead) return 'FAILED'

    if (this.workPhase === 'SCANNING') {
      this.currentTile = this.findNeediestTile()
      if (!this.currentTile) {
        // 더 이상 할 일이 없으면 보관된 수확물을 납품하러 감 (만약 있다면)
        return 'COMPLETED'
      }
      this.workPhase = 'MOVING'
    }

    if (this.workPhase === 'MOVING') {
      // 농장 중심에서 타일 인덱스에 따른 상대 좌표 계산 (10x10 격자)
      const col = this.currentTile.id % 10
      const row = Math.floor(this.currentTile.id / 10)
      const targetX = this.target.x - 40 + col * 8
      const targetY = this.target.y - 40 + row * 8

      const dist = creature.distanceTo({ x: targetX, y: targetY })
      if (dist < 5) {
        this.workPhase = 'WORKING'
        this.workTimer = 0
      } else {
        creature.moveToTarget(targetX, targetY, deltaTime, world)
      }
    }

    if (this.workPhase === 'WORKING') {
      this.workTimer += deltaTime
      creature.state = 'WORKING'
      
      // 작업 종류에 따른 소요 시간 (씨뿌리기: 1초, 물주기: 0.5초, 수확: 1.5초)
      let requiredTime = 1000
      if (this.currentTile.status === 'RIPE') requiredTime = 1500
      if (this.currentTile.moisture < 30) requiredTime = 500

      if (this.workTimer >= requiredTime) {
        this.applyTaskEffect()
        this.workPhase = 'SCANNING' // 다음 타일 탐색
      }
    }

    return 'RUNNING'
  }

  findNeediestTile() {
    const crops = this.target.crops
    if (!crops) return null

    // 우선순위: 1. 수확(RIPE), 2. 물주기(Low Moisture), 3. 씨뿌리기(EMPTY)
    const ripe = crops.find(c => c.status === 'RIPE')
    if (ripe) return ripe

    const dry = crops.find(c => c.status !== 'EMPTY' && c.moisture < 30)
    if (dry) return dry

    const empty = crops.find(c => c.status === 'EMPTY')
    if (empty) return empty

    return null
  }

  applyTaskEffect() {
    const tile = this.currentTile
    if (tile.status === 'RIPE') {
      tile.status = 'EMPTY'
      tile.growth = 0
      // 💡 농장 인벤토리에 식량 추가 (나중에 한꺼번에 납품)
      if (this.target.village) {
        this.target.village.inventory.food = (this.target.village.inventory.food || 0) + 5
      }
    } else if (tile.status === 'EMPTY') {
      tile.status = 'PLANTED'
      tile.growth = 0
      tile.moisture = 100
    } else if (tile.moisture < 30) {
      tile.moisture = 100
    }
  }

  onComplete(creature, world) {
    creature.target = null
    creature.state = 'IDLE'
  }
}
