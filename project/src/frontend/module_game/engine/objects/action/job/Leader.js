import { JobAssigner } from '../JobAssigner.js'

export const LEADER = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)

  // [버그③ 수정] 10% 확률에서 → 매 틱마다 미배정(NONE) 크리쳐를 우선 처리
  const unassigned = creature.village.creatures.filter(
    (c) => c.isAdult && c.profession === 'NONE' && c !== creature,
  )
  if (unassigned.length > 0) {
    // 미배정 크리쳐가 있으면 즉시 배정
    unassigned.forEach((c) => JobAssigner.forceAssignJob(world, c))
  } else if (Math.random() < 0.3) {
    // 주기적으로 전체 재평가 (인구 변화에 맞춰 직업 재배정)
    const adults = creature.village.creatures.filter((c) => c.isAdult && c.profession !== 'LEADER')
    adults.forEach((c) => JobAssigner.forceAssignJob(world, c))
  }

  creature.wander(world, 50)
}
