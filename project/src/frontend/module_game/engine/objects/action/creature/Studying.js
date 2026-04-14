export const STUDYING = (creature, deltaTime, world) => {
  const school = creature.target
  // [추가] 목표가 학교가 아니거나 파괴되었으면 배회
  if (!school || school.isDead || !school.isConstructed || school.type !== 'SCHOOL') {
    creature.state = 'WANDERING'
    creature.target = null
    return
  }

  if (creature.distanceTo(school) < creature.size + (school.size || 0)) {
    if (creature.village) {
      // [수정] 학자가 학교에 있을 때만 지식 생산
      creature.village.inventory.knowledge =
        (creature.village.inventory.knowledge || 0) + deltaTime * 0.02 // 패시브보다 2배 빠르게 생산
    }
    // [추가] 공부를 충분히 했으면 (10초) 배회 상태로 전환
    creature.aiTickTimer += deltaTime
    if (creature.aiTickTimer > 10000) {
      creature.aiTickTimer = 0
      creature.state = 'WANDERING'
      creature.target = null
    }
  } else {
    creature.moveToTarget(school.x, school.y, deltaTime, world)
  }
}
