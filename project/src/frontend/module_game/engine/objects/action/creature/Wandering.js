import { JobAssigner } from '../../job/JobAssigner'
import { CreatureEmotion } from '../../emotions/CreatureEmotion.js'

export const WANDERING = (creature, deltaTime, world) => {
  creature.aiTickTimer += deltaTime
  if (creature.aiTickTimer >= 1000) {
    creature.aiTickTimer = 0

    // 1. 감정 모듈에서 생존 욕구 평가 후 행동 덮어쓰기
    if (CreatureEmotion.evaluateSurvivalNeeds(creature, world)) return

    // 2. 생존 욕구가 없으면 직업 탐색
    if (creature.isAdult && Math.random() < 0.1) {
      JobAssigner.assignProfession(creature, world)
    }

    creature.findWork(world)
  }
  creature.moveToTarget(creature.targetX, creature.targetY, deltaTime, world)
}
