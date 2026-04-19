import { WANDERING }  from './creature/Wandering.js'
import { STUDYING }   from './creature/Studying.js'
import { GATHERING }  from './creature/Gathering.js'
import { HARVESTING } from './creature/Harvesting.js'
import { MINING }     from './creature/Mining.js'
import { BUILDING }   from './creature/Building.js'
import { ATTACKING }  from './creature/Attacking.js'
import { RESTING }    from './creature/Resting.js'
import { RETURNING }  from './creature/Returning.js'
import { FLEEING }    from './creature/Fleeing.js'
import { MATING }     from './creature/Mating.js'
import { TRAINING }   from './creature/Training.js'

import { BUILDER }    from './job/Builder.js'
import { FARMER }     from './job/Farmer.js'
import { GATHERER }   from './job/Gatherer.js'
import { LEADER }     from './job/Leader.js'
import { LUMBERJACK } from './job/Lumberjack.js'
import { MERCHANT }   from './job/Merchant.js'
import { MINER }      from './job/Miner.js'
import { SCHOLAR }    from './job/Scholar.js'
import { WARRIOR }    from './job/Warrior.js'

import { DRIVE }      from '../emotions/CreatureEmotion.js'
import { MoveTask }   from '../tasks/MoveTask.js'
import { SleepTask }  from '../tasks/SleepTask.js'
import { EatTask }    from '../tasks/EatTask.js'

export const CreatureActions = {
  // 직업별 일거리 주입 (Job Behaviors)
  JobInjectors: {
    BUILDER, FARMER, GATHERER, LEADER, LUMBERJACK, MERCHANT, MINER, SCHOLAR, WARRIOR
  },

  // 생존욕구 기반 행동 주입 (Survival Behaviors)
  SurvivalInjectors: {
    [DRIVE.PANIC]: (creature, payload, _world) => {
      creature.state = 'FLEEING'
      creature.targetX = creature.x + (creature.x - payload.threat.x)
      creature.targetY = creature.y + (creature.y - payload.threat.y)
    },
    [DRIVE.MATING]: (creature, payload, _world) => {
      creature.target = payload.partner
      creature.state = 'MATING'
      payload.partner.target = creature
      payload.partner.state = 'MATING'
      creature.matingCooldown = 20000
      payload.partner.matingCooldown = 20000
    },
    [DRIVE.SLEEP]: (creature, payload, _world) => {
      const target = payload.house || payload.village
      if (target) {
        creature.taskQueue.push(new MoveTask(target, target.radius || 40))
        creature.taskQueue.push(new SleepTask(target))
      }
    },
    [DRIVE.EAT]: (creature, payload, _world) => {
      const target = payload.food || payload.village
      if (target) {
        creature.taskQueue.push(new MoveTask(target, target.radius || 40))
        creature.taskQueue.push(new EatTask(target))
      }
    },
    [DRIVE.SOCIAL]: (creature, _payload, world) => {
      const emojis = ['👋 안녕!', '❤️', '🍞 배고파', '😡', '🤝 거래할까?', '🤔 흠..', '💤 피곤해']
      const text = emojis[Math.floor(Math.random() * emojis.length)]
      const idx = world.creatures.indexOf(creature)
      if (idx !== -1) world.showSpeechBubble(idx, 'creature', text, 2000)
    },
    [DRIVE.NONE]: (_creature, _payload, _world) => {},
  },

  // 상태 기반 프레임별 실행 (State Execution)
  StateExecutors: {
    WANDERING, STUDYING, GATHERING, HARVESTING, MINING, BUILDING,
    ATTACKING, RESTING, RETURNING, FLEEING, MATING, TRAINING,
    IDLE: () => {},
    EATING: () => {},
    DEPOSITING: () => {},
    SUFFERING: () => {},

    TRADING: (creature, deltaTime, world) => {
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
            const takeWood = Math.min(5,  targetVillage.inventory.wood  || 0)
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
    }
  }
}
