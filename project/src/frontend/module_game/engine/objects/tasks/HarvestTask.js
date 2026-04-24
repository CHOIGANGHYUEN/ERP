import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class HarvestTask extends BaseTask {
  constructor(target) {
    super('HARVEST')
    this.target = target
    this.checkTimer = 0
  }

  onEnter(creature, world) {
    // 타겟이 유효한지 최종 검사
    if (!this.target || this.target.isDead) {
      throw new Error('Target already dead or missing')
    }
  }

  onRunning(creature, deltaTime, world) {
    // 💡 [원칙 3: 성능 최적화] 매 틱 검사 대신 타이머 기반 검출
    this.checkTimer += deltaTime
    if (this.checkTimer >= 1000) {
      this.checkTimer = 0
      // 엣지 케이스 1: 타겟 증발 체크
      if (!this.target || this.target.isDead || !world.getEntityById(this.target.id, this.target._type)) {
        return 'FAILED'
      }
    }

    const dist = creature.distanceTo(this.target)
    const interactRange = creature.size + (this.target.size || 8)

    if (dist <= interactRange) {
      // 렌더링 상태 업데이트
      this.updateStateByTarget(creature)

      // 에너지 소모 연산 (Resource 드랍 아이템 vs 생산 자원)
      if (this.target.energy === undefined || this.target.energy === null) {
        this.collectItem(creature, world)
        return 'COMPLETED'
      }

      this.target.energy -= deltaTime * 0.05 * (creature.workEfficiency || 1.0)
      if (this.target.energy <= 0) {
        this.collectResource(creature, world)
        return 'COMPLETED'
      }
    } else {
      // 엣지 케이스 3: 갑자기 멀어짐 (지형/밀치기 등) -> 다시 이동 위임
      creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
    }

    return 'RUNNING'
  }

  onFailed(creature, world, reason) {
    // 엣지 케이스 방어: 실패 시 블랙리스트 추가 및 상태 초기화
    if (this.target && world.blacklistService) {
      world.blacklistService.add(this.target.id)
    }
    creature.state = 'IDLE'
    creature.target = null
  }

  updateStateByTarget(creature) {
    const t = this.target.type
    if (['iron', 'stone', 'gold', 'mine'].includes(t)) creature.state = 'MINING'
    else if (t === 'tree') creature.state = 'HARVESTING'
    else creature.state = 'GATHERING'
  }

  collectItem(creature, world) {
    const t = this.target.type
    creature.inventory[t] = (creature.inventory[t] || 0) + 1
    this.target.die(world, 'Collected')
  }

  collectResource(creature, world) {
    const t = this.target.type
    let amount = 2
    if (['crop', 'grass', 'food'].includes(t)) {
      if (creature.needs?.hunger > 50) CreatureEmotion.fulfillHunger(creature)
      else creature.inventory.food = (creature.inventory.food || 0) + 3
    } else if (t === 'tree' || t === 'wood') {
      creature.inventory.wood = (creature.inventory.wood || 0) + amount
    } else {
      const key = creature.inventory[t] !== undefined ? t : 'biomass'
      creature.inventory[key] = (creature.inventory[key] || 0) + amount
    }
    this.target.die(world, 'Harvested')
  }
}
