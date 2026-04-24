import { WANDERING } from './creature/Wandering.js'
import { STUDYING } from './creature/Studying.js'
import { GATHERING } from './creature/Gathering.js'
import { HARVESTING } from './creature/Harvesting.js'
import { MINING } from './creature/Mining.js'
import { BUILDING } from './creature/Building.js'
import { ATTACKING } from './creature/Attacking.js'
import { RESTING } from './creature/Resting.js'
import { RETURNING } from './creature/Returning.js'
import { FLEEING } from './creature/Fleeing.js'
import { MATING } from './creature/Mating.js'
import { TRAINING } from './creature/Training.js'

import { BUILDER } from './job/Builder.js'
import { FARMER } from './job/Farmer.js'
import { GATHERER } from './job/Gatherer.js'
import { LEADER } from './job/Leader.js'
import { LUMBERJACK } from './job/Lumberjack.js'
import { MERCHANT } from './job/Merchant.js'
import { MINER } from './job/Miner.js'
import { SCHOLAR } from './job/Scholar.js'
import { WARRIOR } from './job/Warrior.js'

import { DRIVE } from '../emotions/CreatureEmotion.js'
import { MoveTask } from '../tasks/MoveTask.js'
import { SleepTask } from '../tasks/SleepTask.js'
import { EatTask } from '../tasks/EatTask.js'

// 💡 [추가] 개별 크리쳐 액션 중 에러 발생 시 전체 틱이 멈추는 것을 방지하는 래퍼 함수
const safe =
  (fn) =>
  (entity, ...args) => {
    try {
      return fn(entity, ...args)
    } catch (error) {
      console.error(`[Creature Action Error] ID: ${entity?.id}`, error)
      if (entity) {
        entity.state = 'WANDERING'
        entity.target = null
      }
    }
  }

export const CreatureActions = {
  // 직업별 일거리 주입 (Job Behaviors)
  JobInjectors: {
    BUILDER: safe(BUILDER),
    FARMER: safe(FARMER),
    GATHERER: safe(GATHERER),
    LEADER: safe(LEADER),
    LUMBERJACK: safe(LUMBERJACK),
    MERCHANT: safe(MERCHANT),
    MINER: safe(MINER),
    SCHOLAR: safe(SCHOLAR),
    WARRIOR: safe(WARRIOR),
  },

  // 생존욕구 기반 행동 주입 (Survival Behaviors)
  SurvivalInjectors: {
    [DRIVE.PANIC]: safe((creature, payload, world) => {
      creature.state = 'FLEEING'
      let tx = creature.x + (creature.x - payload.threat.x)
      let ty = creature.y + (creature.y - payload.threat.y)
      // 💡 [프리징 방어] 도망갈 목표 좌표를 월드 내부로 제한하여 길찾기 연산 폭주 차단
      creature.targetX = world ? Math.max(16, Math.min(tx, world.width - 16)) : tx
      creature.targetY = world ? Math.max(16, Math.min(ty, world.height - 16)) : ty
    }),
    [DRIVE.MATING]: safe((creature, payload, _world) => {
      creature.target = payload.partner
      creature.state = 'MATING'
      payload.partner.target = creature
      payload.partner.state = 'MATING'
      creature.matingCooldown = 20000
      payload.partner.matingCooldown = 20000
    }),
    [DRIVE.SLEEP]: safe((creature, payload, _world) => {
      const target = payload.house || payload.village
      if (target) {
        creature.taskQueue.push(new MoveTask(target, target.radius || 40))
        creature.taskQueue.push(new SleepTask(target))
      }
    }),
    [DRIVE.EAT]: safe((creature, payload, _world) => {
      const target = payload.food || payload.village
      if (target) {
        creature.taskQueue.push(new MoveTask(target, target.radius || 40))
        creature.taskQueue.push(new EatTask(target))
      }
    }),
    [DRIVE.SOCIAL]: safe((creature, _payload, world) => {
      const emojis = ['👋 안녕!', '❤️', '🍞 배고파', '😡', '🤝 거래할까?', '🤔 흠..', '💤 피곤해']
      const text = emojis[Math.floor(Math.random() * emojis.length)]
      const idx = world.creatures.indexOf(creature)
      if (idx !== -1) world.showSpeechBubble(idx, 'creature', text, 2000)
    }),
    [DRIVE.NONE]: safe((_creature, _payload, _world) => {}),
  },

  // 상태 기반 프레임별 실행 (State Execution)
  StateExecutors: {
    WANDERING: safe(WANDERING),
    STUDYING: safe(STUDYING),
    GATHERING: safe(GATHERING),
    HARVESTING: safe(HARVESTING),
    MINING: safe(MINING),
    BUILDING: safe(BUILDING),
    ATTACKING: safe(ATTACKING),
    RESTING: safe(RESTING),
    RETURNING: safe(RETURNING),
    FLEEING: safe(FLEEING),
    MATING: safe(MATING),
    TRAINING: safe(TRAINING),
    IDLE: safe(() => {}),
    MOVING: safe(() => {}), // MoveTask 진행 중 상태 - WANDERING executor 충돌 방지용
    EATING: safe(() => {}),
    DEPOSITING: safe(() => {}),
    SUFFERING: safe(() => {}),

    TRADING: safe((creature, deltaTime, world) => {
      if (!creature.target || creature.target.isDead) {
        creature.state = 'WANDERING'
        creature.target = null
        return
      }
      if (creature.distanceTo(creature.target) < 60) {
        creature.tradeTimer = (creature.tradeTimer || 0) + deltaTime
        if (creature.tradeTimer >= 3000) {
          creature.tradeTimer = 0
          const targetVillage = creature.target
          if (targetVillage.inventory && creature.village) {
            const takeFood = Math.min(10, targetVillage.inventory.food || 0)
            const takeWood = Math.min(5, targetVillage.inventory.wood || 0)
            targetVillage.inventory.food -= takeFood
            targetVillage.inventory.wood -= takeWood
            creature.inventory.food = (creature.inventory.food || 0) + takeFood
            creature.inventory.wood = (creature.inventory.wood || 0) + takeWood
            creature.state = 'RETURNING'
            creature.target = creature.village
            const idx = world.creatures.indexOf(creature)
            if (idx !== -1) world.showSpeechBubble(idx, 'creature', '🤝 교역 완료!', 2000)
          } else {
            creature.state = 'WANDERING'
            creature.target = null
          }
        }
      } else {
        creature.moveToTarget(creature.target.x, creature.target.y, deltaTime, world)
      }
    }),
  },
}
