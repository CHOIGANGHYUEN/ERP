export const TRAINING = (creature, deltaTime, world) => {
  const barracks = creature.target
  // 목표가 병영이 아니거나 파괴되었으면 배회
  if (!barracks || barracks.isDead || !barracks.isConstructed || barracks.type !== 'BARRACKS') {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }

  // 병영에 도착하면
  if (creature.distanceTo(barracks) < creature.size + barracks.size / 2) {
    // 공격력 단련 (최대 3배까지)
    if (creature.attackPower < 3.0) {
      creature.attackPower += deltaTime * 0.0005
    }

    // 훈련을 충분히 했으면 (5초) 배회 상태로 전환
    creature.aiTickTimer += deltaTime
    if (creature.aiTickTimer > 5000) {
      creature.aiTickTimer = 0
      creature.state = 'WANDERING'
      creature.target = null
    }
  } else {
    // 병영으로 이동
    creature.moveToTarget(barracks.x, barracks.y, deltaTime, world)
  }
}
