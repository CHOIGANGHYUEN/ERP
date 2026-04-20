import { WANDERING } from './animal/Wandering.js'
import { EATING } from './animal/Eating.js'
import { HUNTING } from './animal/Hunting.js'
import { RESTING } from './animal/Resting.js'
import { MATING } from './animal/Mating.js'

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
      animal.state = 'WANDERING'
      animal.targetX = animal.x + (animal.x - target.x)
      animal.targetY = animal.y + (animal.y - target.y)
      animal.target = null
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

  // ── 지속 상태(State) 기반 매 프레임 업데이트 ──
  WANDERING: { execute: safeAnimal(WANDERING) },
  EATING: { execute: safeAnimal(EATING) },
  HUNTING: { execute: safeAnimal(HUNTING) },
  RESTING: { execute: safeAnimal(RESTING) },
  MATING: { execute: safeAnimal(MATING) },
  IDLE: { execute: safeAnimal((_animal, _deltaTime, _world) => {}) },
}
