import { CreatureEmotion } from '../../emotions/CreatureEmotion.js'

export const GATHERING = (creature, deltaTime, world) => {
  if (!creature.target || creature.target.isDead) {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }
  if (creature.distanceTo(creature.target) < creature.size) {
    // 감정 모듈 연동: 배고파서 캔 식량이면 그 자리에서 먹고 해소
    if (
      (creature.target.type === 'food' || creature.target.type === 'crop') &&
      creature.needs.hunger > 50
    ) {
      CreatureEmotion.fulfillHunger(creature)
    } else {
      creature.inventory[creature.target.type] = (creature.inventory[creature.target.type] || 0) + 1
    }

    creature.target.isDead = true
    world.removeResource(creature.target)

    if (creature.village) {
      const currentLoad = Object.values(creature.inventory).reduce((a, b) => a + b, 0)
      if (currentLoad >= 5) {
        creature.state = 'RETURNING'
        creature.target = creature.village
      } else {
        creature.state = 'WANDERING'
        creature.target = null
      }
    } else {
      creature.state = 'WANDERING'
      creature.target = null
    }
  } else {
    creature.moveToTarget(creature.target.x, creature.target.y, deltaTime, world)
  }
}
