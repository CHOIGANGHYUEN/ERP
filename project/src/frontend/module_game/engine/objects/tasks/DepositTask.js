import { BaseTask } from './BaseTask.js'
import { CreatureEmotion } from '../emotions/CreatureEmotion.js'

export class DepositTask extends BaseTask {
  constructor(village) {
    super('DEPOSIT')
    this.name = '창고 납부 중'
    this.village = village
    this.depositTimer = 0  // 납부 애니메이션 지속 시간
  }

  execute(creature, deltaTime, world) {
    this.status = 'RUNNING'
    
    if (!this.village) {
      this.status = 'FAILED'
      return this.status
    }

    if (creature.distanceTo(this.village) <= 60) {
      // 창고납부 중 상태로 전환 (애니메이션)
      creature.state = 'DEPOSITING'

      // 납부 애니메이션을 짧게(800ms) 보여준 뒤 실제 처리
      this.depositTimer += deltaTime
      if (this.depositTimer < 800) {
        return this.status 
      }

      // 창고에 인벤토리 아이템 적재 (안전한 합산)
      const inv = this.village.inventory
      if (inv) {
        let totalDeposited = 0
        Object.keys(creature.inventory).forEach(key => {
          const amount = creature.inventory[key] || 0
          if (amount > 0) {
            inv[key] = (inv[key] || 0) + amount
            totalDeposited += amount
          }
        })

        // 💡 [로그 최적화] 개별 입고 로그는 스팸성이 짙으므로 말풍선으로만 표시하거나 생략함
        if (totalDeposited > 0) {
          world.showSpeechBubble(creature.id, 'creature', `📦 +${totalDeposited}`, 1500)
        }
      }
      
      // 소지품 확실히 비우기
      creature.inventory = { wood: 0, biomass: 0, food: 0, stone: 0, iron: 0, gold: 0 }
      creature.state = 'IDLE'

      this.status = 'COMPLETED'
    } else {
      // 💡 [수정] 이미 MoveTask가 여기까지 데려왔어야 하지만, 만약 멀다면 강제 이동 시도
      creature.moveToTarget(this.village.x, this.village.y, deltaTime, world)
    }

    return this.status
  }
}
