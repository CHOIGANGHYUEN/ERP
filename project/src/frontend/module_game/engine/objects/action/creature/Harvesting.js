import { CreatureEmotion } from '../../emotions/CreatureEmotion.js'

export const HARVESTING = (creature, deltaTime, world) => {
  if (!creature.target || creature.target.isDead) {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }
  if (creature.distanceTo(creature.target) < creature.size + (creature.target.size || 0)) {
    creature.target.energy -= deltaTime * 0.05 * creature.workEfficiency
    if (creature.target.energy <= 0) {
      const targetType = creature.target.type

      // 수확물을 인벤토리에 저장 (버그② 핵심 수정)
      if (targetType === 'crop' || targetType === 'grass') {
        // 배가 고프면 즉시 섭취, 아니면 인벤토리에 저장
        if (creature.needs.hunger > 50) {
          CreatureEmotion.fulfillHunger(creature)
        } else {
          creature.inventory.food = (creature.inventory.food || 0) + 3 // 수확량 3
        }
      } else if (targetType === 'tree') {
        creature.inventory.wood = (creature.inventory.wood || 0) + 2
      } else {
        // 기타 식물 타입은 biomass로 저장
        creature.inventory.biomass = (creature.inventory.biomass || 0) + 1
      }

      creature.target.die(world)
      creature.target = null

      // 인벤토리가 충분히 차면 마을로 귀환 (버그② 귀환 트리거)
      const currentLoad = Object.values(creature.inventory).reduce((a, b) => a + b, 0)
      if (creature.village && currentLoad >= 3) {
        creature.state = 'RETURNING'
        creature.target = creature.village
      } else {
        creature.state = 'WANDERING'
      }
    }
  } else {
    creature.moveToTarget(creature.target.x, creature.target.y, deltaTime, world)
  }
}
