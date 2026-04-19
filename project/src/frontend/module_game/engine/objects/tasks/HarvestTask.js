import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class HarvestTask extends BaseTask {
  constructor(target) {
    super('HARVEST')
    this.target = target
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'
    
    // 만일 작업할 대상이 죽었거나 없으면 실패로 간주하고 다음 태스크로 넘어감
    if (!this.target || this.target.isDead) {
      this.status = 'FAILED'
      return this.status
    }

    const dist = creature.distanceTo(this.target)
    if (dist <= creature.size + (this.target.size || 0)) {
      // ── 렌더링 상태 지정 ─────────────────────────────────────────
      if (this.target.type === 'iron' || this.target.type === 'stone' || this.target.type === 'gold' || this.target.type === 'mine') {
        creature.state = 'MINING'
      } else if (this.target.type === 'tree') {
        creature.state = 'HARVESTING'
      } else {
        creature.state = 'GATHERING'
      }

      // ── energy가 없는 대상(Resource 드랍 아이템: food/biomass/wood 등)
      //    energy가 undefined이면 즉시 수집하고 완료 처리
      if (this.target.energy === undefined || this.target.energy === null) {
        // 아이템 타입에 따라 인벤토리에 추가
        const t = this.target.type
        if (t === 'food')    creature.inventory.food    = (creature.inventory.food    || 0) + 1
        else if (t === 'wood')    creature.inventory.wood    = (creature.inventory.wood    || 0) + 1
        else if (t === 'stone')   creature.inventory.stone   = (creature.inventory.stone   || 0) + 1
        else if (t === 'iron')    creature.inventory.iron    = (creature.inventory.iron    || 0) + 1
        else if (t === 'gold')    creature.inventory.gold    = (creature.inventory.gold    || 0) + 1
        else if (t === 'biomass') creature.inventory.biomass = (creature.inventory.biomass || 0) + 1
        else                      creature.inventory.biomass = (creature.inventory.biomass || 0) + 1

        this.target.die(world)  // Resource 아이템 제거
        this.status = 'COMPLETED'
        return this.status
      }

      // ── energy가 있는 대상(식물, Mine 등) → 기존 채굴 로직 ──────
      this.target.energy -= deltaTime * 0.05 * creature.workEfficiency

      if (this.target.energy <= 0) {
        const targetType = this.target.type

        // 자원 획득 로직
        if (targetType === 'crop' || targetType === 'grass' || targetType === 'food') {
          if (creature.needs.hunger > 50) {
            CreatureEmotion.fulfillHunger(creature)
          } else {
            creature.inventory.food = (creature.inventory.food || 0) + 3
          }
        } else if (targetType === 'tree' || targetType === 'wood') {
          creature.inventory.wood = (creature.inventory.wood || 0) + 2
        } else if (targetType === 'mine') {
          creature.inventory.stone = (creature.inventory.stone || 0) + 2
        } else {
          if (targetType === 'stone')      creature.inventory.stone = (creature.inventory.stone || 0) + 2
          else if (targetType === 'iron')  creature.inventory.iron  = (creature.inventory.iron  || 0) + 2
          else if (targetType === 'gold')  creature.inventory.gold  = (creature.inventory.gold  || 0) + 2
          else                             creature.inventory.biomass = (creature.inventory.biomass || 0) + 1
        }

        this.target.die(world)
        this.status = 'COMPLETED'
      }
    } else {
       // 만약 실수로 거리가 멀어졌다면? 다시 이동하거나 (스스로 이동 로직 호출) Fail 처리
       // 이 태스크 전에는 반드시 MoveTask가 선행되어야 함
       creature.moveToTarget(this.target.x, this.target.y, deltaTime, world)
    }

    return this.status
  }
}
