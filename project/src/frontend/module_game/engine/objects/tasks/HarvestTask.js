import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class HarvestTask extends BaseTask {
  constructor(target) {
    super('HARVEST')
    this.target = target
    this.checkTimer = 0
  }

  onEnter(creature, world) {
    if (!this.target || this.target.isDead) {
      throw new Error('Target already dead or missing')
    }
    creature.target = this.target // 8방향 렌더링을 위한 타겟 고정
    this.target.isTargeted = true // 타겟 선점 (중복 방지)
  }

  onRunning(creature, deltaTime, world) {
    this.checkTimer += deltaTime
    if (this.checkTimer >= 1000) {
      this.checkTimer = 0
      if (!this.target || this.target.isDead || !world.getEntityById(this.target.id, this.target._type)) {
        return 'FAILED'
      }
    }

    const dist = creature.distanceTo(this.target)
    const interactRange = creature.size + (this.target.size || 12) + 15

    if (dist <= interactRange) {
      this.updateStateByTarget(creature)

      if (this.target.energy === undefined) {
        this.collectItem(creature, world)
        return 'COMPLETED'
      }

      this.target.energy -= deltaTime * 0.05 * (creature.workEfficiency || 1.0)
      if (this.target.energy <= 0) {
        this.collectResource(creature, world)
        return 'COMPLETED'
      }
    } else {
      // 거리가 벌어지면 다시 이동 위임 (실패 처리 후 WorkSystem이 재할당)
      return 'FAILED'
    }

    return 'RUNNING'
  }

  onComplete(creature, world) {
    if (this.target) {
      this.target.isTargeted = false
      // 💡 게시판에서 작업 제거 (personal task는 targetId 기반 id 형식을 따름)
      if (world.taskBoardService && creature.village) {
        const vIdx = world.villages.indexOf(creature.village)
        world.taskBoardService.completeTask(vIdx, `personal-${this.target.id}`)
      }
    }
    creature.target = null
  }

  onFailed(creature, world, reason) {
    if (this.target) {
      this.target.isTargeted = false
      if (world.blacklistService) world.blacklistService.add(this.target.id)
    }
    creature.state = 'IDLE'
    creature.target = null
  }

  updateStateByTarget(creature) {
    const t = this.target.type || this.target._type
    if (['iron', 'stone', 'gold', 'mine'].includes(t)) creature.state = 'MINING'
    else if (t === 'tree') creature.state = 'HARVESTING'
    else creature.state = 'GATHERING'
  }

  collectItem(creature, world) {
    const t = this.target.type || this.target._type
    creature.inventory[t] = (creature.inventory[t] || 0) + 1
    this.target.die(world, 'Collected')
  }

  collectResource(creature, world) {
    const t = this.target.type || this.target._type
    let amount = 2
    if (['crop', 'grass', 'food'].includes(t)) {
      if (creature.needs?.hunger > 50) CreatureEmotion.fulfillHunger(creature)
      else creature.inventory.food = (creature.inventory.food || 0) + 3
    } else if (t === 'tree' || t === 'wood') {
      creature.inventory.wood = (creature.inventory.wood || 0) + amount
    } else {
      creature.inventory.biomass = (creature.inventory.biomass || 0) + amount
    }
    this.target.die(world, 'Harvested')
  }
}
