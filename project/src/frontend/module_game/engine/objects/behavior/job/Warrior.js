export const WARRIOR = (creature, world, _candidates) => {
  if (!creature.village) return creature.wander(world)
  const searchRadius = creature.village.radius + 100
  const range = {
    x: creature.village.x - searchRadius,
    y: creature.village.y - searchRadius,
    width: searchRadius * 2,
    height: searchRadius * 2,
  }
  const threats = world.chunkManager.query(range)
  let closestThreat = null,
    minThreatDist = Infinity,
    closestEnemy = null,
    minEnemyDist = Infinity

  for (const t of threats) {
    if (t.isDead) continue
    const dist = creature.distanceTo(t)

    if (t.type === 'CARNIVORE') {
      if (dist < searchRadius && dist < minThreatDist) {
        closestThreat = t
        minThreatDist = dist
      }
    } else if (
      t.profession === 'WARRIOR' &&
      t.village?.nation &&
      creature.village.nation.getRelation(t.village.nation).status === 'WAR'
    ) {
      if (dist < searchRadius && dist < minEnemyDist) {
        closestEnemy = t
        minEnemyDist = dist
      }
    }
  }

  if (closestThreat || closestEnemy) {
    creature.target = closestThreat || closestEnemy // 육식동물 우선
    creature.state = 'ATTACKING'
  } else {
    // [추가] 위협이 없으면 20% 확률로 병영을 찾아 훈련
    if (Math.random() < 0.2) {
      const barracks = creature.village.buildings.find(
        (b) => b.type === 'BARRACKS' && b.isConstructed,
      )
      if (barracks) {
        creature.target = barracks
        creature.state = 'TRAINING'
        return
      }
    }
    // 할일 없으면 마을 순찰
    creature.wander(world, creature.village.radius)
  }
}
