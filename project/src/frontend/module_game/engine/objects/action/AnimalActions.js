import { WANDERING } from './animal/Wandering.js'
import { EATING } from './animal/Eating.js'
import { HUNTING } from './animal/Hunting.js'
import { RESTING } from './animal/Resting.js'
import { MATING } from './animal/Mating.js'
import { HIDING } from './animal/Hiding.js'
import { FOLLOWING } from './animal/Following.js'

// 💡 [추가] 동물 액션 중단 방지 래퍼
const safeAnimal =
  (fn) =>
    (animal, ...args) => {
      try {
        return fn(animal, ...args)
      } catch (error) {
        console.error(`[Animal Action Error] ID ${animal?.id}:`, error)
        if (animal) {
          animal.state = 'WANDERING'
          animal.target = null
        }
      }
    }

// 하나의 객체 내에서 의도(Drive Behavior)의 전의와 지속 상태(State Action)의 실행을 융합합니다.
export const AnimalActions = {
  // ── 생존 충동(Drive) 행동 설정 (기존 AnimalBehaviors) ──
  FLEE: {
    start: safeAnimal((animal, target, _world) => {
      animal.state = 'FLEEING'
      animal.targetX = animal.x + (animal.x - target.x)
      animal.targetY = animal.y + (animal.y - target.y)
      animal.target = target
    }),
  },
  EAT: {
    start: safeAnimal((animal, target, _world) => {
      animal.state = 'EATING'
      animal.target = target
    }),
  },
  HUNT: {
    start: safeAnimal((animal, target, _world) => {
      animal.state = 'HUNTING'
      animal.target = target
    }),
  },
  REST: {
    start: safeAnimal((animal, _target, _world) => {
      animal.state = 'RESTING'
      animal.targetX = animal.x
      animal.targetY = animal.y
    }),
  },
  MATE: {
    start: safeAnimal((animal, target, _world) => {
      animal.state = 'MATING'
      animal.target = target
    }),
  },
  HIDE: {
    start: safeAnimal((animal, target, _world) => {
      animal.state = 'HIDING'
      animal.target = target
    }),
  },
  FOLLOW: {
    start: safeAnimal((animal, target, _world) => {
      animal.state = 'FOLLOWING'
      animal.target = target
      animal.targetX = animal.x
      animal.targetY = animal.y
    }),
  },

  // ── 지속 상태(State) 기반 매 프레임 업데이트 ──
  WANDERING: { execute: safeAnimal(WANDERING) },
  FLEEING: {
    execute: safeAnimal((animal, deltaTime, world) => {
      if (animal.target && animal.distanceTo(animal.target) > 300) {
        animal.state = 'WANDERING'
        animal.target = null
      } else if (animal.target) {
        const dx = animal.x - animal.target.x
        const dy = animal.y - animal.target.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          animal.targetX = animal.x + (dx / dist) * 100
          animal.targetY = animal.y + (dy / dist) * 100
        }
        animal.moveToTarget(animal.targetX, animal.targetY, deltaTime, world, 1.5)
      } else animal.state = 'WANDERING'
    }),
  },
  EATING: { execute: safeAnimal(EATING) },
  HUNTING: { execute: safeAnimal(HUNTING) },
  RESTING: { execute: safeAnimal(RESTING) },
  MATING: { execute: safeAnimal(MATING) },
  HIDING: { execute: safeAnimal(HIDING) },
  FOLLOWING: { execute: safeAnimal(FOLLOWING) },
  IDLE: { execute: safeAnimal((_animal, _deltaTime, _world) => { }) },
}
