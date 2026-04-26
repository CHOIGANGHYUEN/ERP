import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class HarvestTask extends BaseTask {
  constructor(target) {
    super('HARVEST')
    this.name = '채집 중'
    this.target = target
    this.checkTimer = 0
    this.accumulatedProgress = 0
    this.tickThreshold = 50 // 50 에너지를 소모할 때마다 자원 흭득
  }

  onEnter(creature, world) {
    if (!this.target || this.target.isDead) {
      throw new Error('Target already dead or missing')
    }
    creature.target = this.target
    this.target.isTargeted = true
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

      // 에너지가 없는 단순 아이템인 경우 (기존 로직 유지)
      if (this.target.energy === undefined) {
        this.collectItem(creature, world)
        return 'COMPLETED'
      }

      // 💡 [단계별 채취 로직]
      const workAmount = deltaTime * 0.05 * (creature.workEfficiency || 1.0)
      this.target.energy -= workAmount
      this.accumulatedProgress += workAmount

      // 임계치를 넘을 때마다 자원 획득 (Tick)
      if (this.accumulatedProgress >= this.tickThreshold) {
        this.accumulatedProgress -= this.tickThreshold
        this.harvestTick(creature, world)
      }

      if (this.target.energy <= 0) {
        // 마지막 남은 자취 처리 (있는 경우)
        if (this.accumulatedProgress > this.tickThreshold * 0.5) {
          this.harvestTick(creature, world)
        }
        this.target.die(world, 'Harvested')
        return 'COMPLETED'
      }
    } else {
      return 'FAILED'
    }

    return 'RUNNING'
  }

  /**
   * 🪵 단위 작업 완료 시 실행되는 자원 획득 루틴
   */
  harvestTick(creature, world) {
    const t = this.target.type || this.target._type
    let resourceType = 'biomass'
    let amount = 1
    let icon = '📦'

    if (['crop', 'grass', 'food'].includes(t)) {
      resourceType = 'food'
      icon = '🍎'
      if (creature.needs?.hunger > 60) {
        CreatureEmotion.fulfillHunger(creature)
        icon = '😋'
      }
    } else if (t === 'tree' || t === 'wood') {
      resourceType = 'wood'
      icon = '🪵'
    } else if (['iron', 'stone', 'gold', 'mine'].includes(t)) {
      resourceType = (t === 'mine' ? this.target.type : t)
      icon = '💎'
    }

    // 인벤토리 추가 및 경험치 보너스
    creature.inventory[resourceType] = (creature.inventory[resourceType] || 0) + amount
    if (creature.gainExp) {
      creature.gainExp(2, world) // 틱당 소량의 경험치 즉시 지급
    }

    // 시각적 피드백
    if (world.showSpeechBubble) {
      world.showSpeechBubble(creature.id, 'creature', `${icon} +${amount}`, 1000)
    }
  }

  onComplete(creature, world) {
    if (this.target) {
      this.target.isTargeted = false
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
}
