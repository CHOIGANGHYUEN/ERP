export class DiplomacySystem {
  constructor() {
    this.updateTimer = 0
    this.updateInterval = 5000 // 5초마다 외교 관계 업데이트
  }

  update(deltaTime, world) {
    this.updateTimer += deltaTime
    if (this.updateTimer < this.updateInterval) return

    this.updateTimer = 0
    const nations = world.nations

    if (nations.length < 2) return

    for (let i = 0; i < nations.length; i++) {
      for (let j = i + 1; j < nations.length; j++) {
        const nationA = nations[i]
        const nationB = nations[j]

        this.updateRelationship(nationA, nationB, world)
      }
    }
  }

  updateRelationship(nationA, nationB, _world) {
    let relation = nationA.getRelation(nationB)
    let score = relation.score

    // 영토가 인접/중첩되면 관계 악화
    const isTerritoryTouching = nationA.villages.some((vA) =>
      nationB.villages.some((vB) => vA.distanceTo(vB) < vA.radius + vB.radius),
    )

    if (isTerritoryTouching) {
      score -= 2
    } else {
      score += 0.5 // 시간이 지나면 관계 회복
    }

    // 관계 상태 결정
    if (score <= -100) relation.status = 'WAR'
    else if (score >= 100) relation.status = 'PEACE'
    else if (relation.status === 'WAR' && score > -50) relation.status = 'NEUTRAL'

    nationA.setRelation(nationB, relation.status, Math.max(-100, Math.min(100, score)))
  }
}
