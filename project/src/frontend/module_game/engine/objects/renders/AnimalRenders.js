import { WANDERING } from './animal/Wandering.js'
import { EATING } from './animal/Eating.js'
import { HUNTING } from './animal/Hunting.js'
import { FLEEING } from './animal/Fleeing.js'
import { RESTING } from './animal/Resting.js'
import { MATING } from './animal/Mating.js'

export const AnimalRenders = {
  WANDERING,
  EATING,
  HUNTING,
  FLEEING,
  RESTING,
  MATING,
  HIDING: RESTING, // 은신 시에는 나무 밑에서 웅크리고 휴식 모션 취함
  FOLLOWING: WANDERING, // 부모를 따라갈 때는 걷기/멈춤이므로 기본 보행 렌더러 공유
  IDLE: WANDERING, // 대기 상태 매핑 누락 방지
}
