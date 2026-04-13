import { Rectangle } from '../../systems/QuadTree.js'

export class CreatureEmotion {
  static init(creature) {
    creature.needs = { hunger: 0, fatigue: 0 }
    creature.emotions = { happiness: 100, fear: 0 }
  }

  static update(creature, deltaTime, world) {
    creature.needs.hunger = Math.min(100, creature.needs.hunger + (deltaTime / 1000) * 1.5)
    creature.needs.fatigue = Math.min(100, creature.needs.fatigue + (deltaTime / 1000) * 1.0)
    creature.emotions.happiness = Math.max(
      0,
      100 - (creature.needs.hunger + creature.needs.fatigue) / 2,
    )

    if (creature.needs.hunger >= 100) {
      creature.die(world)
      return true // 아사 처리됨
    }
    return false
  }

  static evaluateSurvivalNeeds(creature, world) {
    if (creature.needs.hunger > 70) {
      const searchRange = new Rectangle(creature.x - 400, creature.y - 400, 800, 800)
      const candidates = world.quadTree.query(searchRange)
      const food = candidates.find(
        (c) => c.type === 'food' || (c.type === 'crop' && c.size >= c.maxSize * 0.8),
      )

      if (food) {
        creature.target = food
        creature.state = 'GATHERING'
        return true
      } else if (creature.village && creature.village.inventory.food > 0) {
        creature.target = creature.village
        creature.state = 'RETURNING'
        return true
      }
    }

    if (creature.needs.fatigue > 80 && creature.village) {
      creature.target = creature.village
      creature.state = 'RETURNING'
      return true
    }
    return false
  }

  static fulfillHunger(creature) {
    creature.needs.hunger = 0
    creature.emotions.happiness = Math.min(100, creature.emotions.happiness + 30)
  }
  static fulfillFatigue(creature) {
    creature.needs.fatigue = 0
  }
}
