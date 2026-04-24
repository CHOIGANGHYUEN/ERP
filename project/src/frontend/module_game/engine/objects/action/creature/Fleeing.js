export const FLEEING = (creature, deltaTime, world) => {
  // 💡 [버그 수정] 공포심이 영원히 유지되지 않도록 시간 경과에 따라 자연 감소
  if (!creature.emotions) creature.emotions = { fear: 100 }
  creature.emotions.fear = (creature.emotions.fear || 100) - (deltaTime * 0.05)

  const prevX = creature.x
  const prevY = creature.y

  // 타겟 좌표로 평소보다 2배 빠르게 이동
  creature.moveToTarget(creature.targetX, creature.targetY, deltaTime, world, 2.0)

  // 목적지에 도착했거나 공포심이 사라지면 배회 상태로 전환
  const dist = Math.sqrt(
    Math.pow(creature.targetX - creature.x, 2) + Math.pow(creature.targetY - creature.y, 2),
  )

  // 💡 [버그 수정] 바다나 산에 막혀서 갇힌 경우(이동 거리 0.1 미만) 도망 상태를 강제 해제하여 옴싹달싹 못 하는 현상 방지
  const movedDist = Math.sqrt(Math.pow(creature.x - prevX, 2) + Math.pow(creature.y - prevY, 2))
  const isStuck = movedDist < 0.1 && Math.random() < 0.1 // 10% 확률로 완전 고립 판정

  if (dist < 20 || creature.emotions.fear <= 10 || isStuck) {
    creature.state = 'WANDERING'
    creature.target = null
  }
}
