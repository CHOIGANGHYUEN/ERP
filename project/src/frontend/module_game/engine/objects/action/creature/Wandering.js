export const WANDERING = (creature, deltaTime, world) => {
  creature.moveToTarget(creature.targetX, creature.targetY, deltaTime, world)
  if (Math.abs(creature.x - creature.targetX) < 5 && Math.abs(creature.y - creature.targetY) < 5) {
    creature.state = 'IDLE' // 도착 시 대기, 다음 AI 틱에서 새 목적지 수령
  }
}
