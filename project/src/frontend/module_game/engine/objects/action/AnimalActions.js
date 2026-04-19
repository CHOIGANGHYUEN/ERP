import { WANDERING } from './animal/Wandering.js'
import { EATING } from './animal/Eating.js'
import { HUNTING } from './animal/Hunting.js'
import { RESTING } from './animal/Resting.js'
import { MATING } from './animal/Mating.js'

// 하나의 객체 내에서 의도(Drive Behavior)의 전의와 지속 상태(State Action)의 실행을 융합합니다.
export const AnimalActions = {
  // ── 생존 충동(Drive) 행동 설정 (기존 AnimalBehaviors) ──
  FLEE: {
    start: (animal, target, _world) => {
      animal.state = 'WANDERING'
      animal.targetX = animal.x + (animal.x - target.x)
      animal.targetY = animal.y + (animal.y - target.y)
      animal.target = null
    }
  },
  EAT: {
    start: (animal, target, _world) => {
      animal.state = 'EATING'
      animal.target = target
    }
  },
  HUNT: {
    start: (animal, target, _world) => {
      animal.state = 'HUNTING'
      animal.target = target
    }
  },
  REST: {
    start: (animal, _target, _world) => {
      animal.state = 'RESTING'
      animal.targetX = animal.x
      animal.targetY = animal.y
    }
  },
  MATE: {
    start: (animal, target, _world) => {
      animal.state = 'MATING'
      animal.target = target
    }
  },

  // ── 지속 상태(State) 기반 매 프레임 업데이트 ──
  WANDERING: { execute: WANDERING },
  EATING:    { execute: EATING },
  HUNTING:   { execute: HUNTING },
  RESTING:   { execute: RESTING },
  MATING:    { execute: MATING },
  IDLE:      { execute: (_animal, _deltaTime, _world) => {} }
}
