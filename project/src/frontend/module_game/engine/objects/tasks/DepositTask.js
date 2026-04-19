import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class DepositTask extends BaseTask {
  constructor(village) {
    super('DEPOSIT')
    this.village = village
    this.depositTimer = 0  // 납부 애니메이션 지속 시간
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'
    
    if (!this.village) {
      this.status = 'FAILED'
      return this.status
    }

    if (creature.distanceTo(this.village) <= this.village.radius || creature.distanceTo(this.village) < 50) {
      // 창고납부 중 상태로 전환 (애니메이션)
      creature.state = 'DEPOSITING'

      // 납부 애니메이션을 짧게(800ms) 보여준 뒤 실제 처리
      this.depositTimer += deltaTime
      if (this.depositTimer < 800) {
        return this.status  // 애니메이션 재생 중
      }

      // 창고에 인벤토리 아이템 적재
      this.village.inventory.biomass += creature.inventory.biomass || 0
      this.village.inventory.wood    += creature.inventory.wood    || 0
      this.village.inventory.food    += creature.inventory.food    || 0
      this.village.inventory.stone   += creature.inventory.stone   || 0
      this.village.inventory.iron    += creature.inventory.iron    || 0
      this.village.inventory.gold    += creature.inventory.gold    || 0
      
      // 인벤토리 초기화
      creature.inventory = { wood: 0, biomass: 0, food: 0, stone: 0, iron: 0, gold: 0 }

      // 집에 온 김에 마을 창고에 먹을 게 있으면 먹기
      if (creature.needs.hunger > 50 && this.village.inventory.food > 0) {
        this.village.inventory.food--
        CreatureEmotion.fulfillHunger(creature)
      }

      this.status = 'COMPLETED'
    } else {
      // 창고로 이동 중
      creature.moveToTarget(this.village.x, this.village.y, deltaTime, world)
    }

    return this.status
  }
}
