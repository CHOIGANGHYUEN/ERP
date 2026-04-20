import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class EatTask extends BaseTask {
  constructor(foodOrVillage) {
    super('EAT')
    this.target = foodOrVillage
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'

    if (!this.target || this.target.isDead) {
      this.status = 'FAILED'
      return this.status
    }

    const dist = creature.distanceTo(this.target)
    if (dist <= 50) {
      // 적당히 접근
      creature.state = 'EATING' // 먹는 행동 묘사

      if (this.target.type === 'food' || this.target.type === 'crop') {
        this.target.die(world)
        CreatureEmotion.fulfillHunger(creature)
        this.status = 'COMPLETED'
      } else if (this.target.type === 'VILLAGE') {
        if (this.target.inventory.food > 0) {
          this.target.inventory.food--
          CreatureEmotion.fulfillHunger(creature)
          this.status = 'COMPLETED'
        } else {
          // 마을에 식량이 없다면 굶주림(실패)
          this.status = 'FAILED'
          this.failReason = 'NO_FOOD'
        }
      } else {
        this.status = 'FAILED'
      }
    } else {
      creature.state = 'WANDERING'
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
    }

    return this.status
  }
}
