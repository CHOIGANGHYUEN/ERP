export const FLEEING = (creature, deltaTime, world) => {
  // 타겟 좌표로 평소보다 2배 빠르게 이동
  creature.moveToTarget(creature.targetX, creature.targetY, deltaTime, world, 2.0)

  // 목적지에 도착했거나 공포심이 사라지면 배회 상태로 전환
  const dist = Math.sqrt(
    Math.pow(creature.targetX - creature.x, 2) + Math.pow(creature.targetY - creature.y, 2),
  )
  if (dist < 20 || creature.emotions.fear <= 10) {
    creature.state = 'WANDERING'
  }
}
