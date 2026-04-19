import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class SleepTask extends BaseTask {
  constructor(houseOrVillage) {
    super('SLEEP')
    this.target = houseOrVillage
    this.timer = 0
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'
    
    if (!this.target) {
      this.status = 'FAILED'
      return this.status
    }

    const dist = creature.distanceTo(this.target)
    if (dist <= (this.target.radius || 50)) {
      creature.state = 'RESTING'
      // 누적된 피로를 서서히 해소
      creature.needs.fatigue -= deltaTime * 0.05
      
      // 피로도가 다 떨어지거나 0이면 수면 종료
      if (creature.needs.fatigue <= 0) {
        creature.needs.fatigue = 0
        this.status = 'COMPLETED'
      }
    } else {
      creature.state = 'WANDERING'
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
    }

    return this.status
  }
}
