import { CreatureEmotion } from '../../emotions/CreatureEmotion.js'

export const RETURNING = (creature, deltaTime, world) => {
  if (!creature.village) {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }

  if (creature.distanceTo(creature.village) < 50) {
    // 창고 납부 중 상태로 전환 (DepositTask가 없는 RETURNING 상태용)
    creature.state = 'DEPOSITING'

    creature.village.inventory.biomass += creature.inventory.biomass || 0
    creature.village.inventory.wood    += creature.inventory.wood    || 0
    creature.village.inventory.food    += creature.inventory.food    || 0
    creature.village.inventory.stone   += creature.inventory.stone   || 0
    creature.village.inventory.iron    += creature.inventory.iron    || 0
    creature.village.inventory.gold    += creature.inventory.gold    || 0
    creature.inventory = { wood: 0, biomass: 0, food: 0, stone: 0, iron: 0, gold: 0 }

    // 집에 온 김에 감정 모듈 연동으로 욕구 해소
    if (creature.needs.hunger > 50 && creature.village.inventory.food > 0) {
      creature.village.inventory.food--
      CreatureEmotion.fulfillHunger(creature)
    }
    if (creature.needs.fatigue > 50) CreatureEmotion.fulfillFatigue(creature)

    // 800ms 뒤 배회 상태로 복귀 (setTimeout 대신 타이머 필드 사용)
    creature._returnTimer = (creature._returnTimer || 0) + deltaTime
    if (creature._returnTimer >= 800) {
      creature._returnTimer = 0
      creature.state = 'WANDERING'
      creature.target = null
    }
  } else {
    creature._returnTimer = 0
    creature.moveToTarget(creature.village.x, creature.village.y, deltaTime, world)
  }
}
