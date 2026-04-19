import { BaseTask } from './BaseTask.js'

export class BuildTask extends BaseTask {
  constructor(targetBuilding) {
    super('BUILD')
    this.target = targetBuilding
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'

    if (!this.target || this.target.isConstructed) {
      this.status = 'COMPLETED'
      return this.status
    }

    const dist = creature.distanceTo(this.target)
    if (dist <= creature.size + (this.target.size || 0)) {
      creature.state = 'BUILDING'
      this.target.progress += deltaTime * 0.05
      
      if (this.target.progress >= this.target.maxProgress) {
        this.target.isConstructed = true
        this.status = 'COMPLETED'
      }
    } else {
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
    }

    return this.status
  }
}
