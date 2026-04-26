export class SteeringService {
  /**
   * ■ 3단계: 로컬 회피 및 조향 서비스
   * 주변 개체들을 감지하여 겹치지 않게 밀어내는 힘을 합산해 최종 조향 벡터를 반환합니다.
   */
  calculateAvoidanceVector(entity, neighbors) {
    const radius = 30 // 반경 30픽셀 이내 탐색
    let repulsionX = 0
    let repulsionY = 0
    let count = 0

    // 1) 척력(Repulsion) 계산
    neighbors.forEach(neighbor => {
      const targetType = neighbor._type || neighbor.type

      // 💡 [핵심 수정] 움직이는 생명체(creature, animal)가 아닌 모든 정적 객체는 회피 대상에서 제외
      // 나무, 농작물, 건물, 자원 덩어리 등을 장애물로 인식하지 않게 함
      const isMobile = targetType === 'creature' || targetType === 'animal'
      if (!isMobile) return

      // 💡 자기 자신이나 현재 작업 중인 목표물(target)은 절대 피하지 않음
      if (neighbor.id === entity.id) return
      if (entity.target && (neighbor.id === entity.target.id || neighbor === entity.target)) return

      // 작업 중인 다른 개체(건설 중인 주민 등)도 가급적 방해하지 않도록 예외 처리 유지
      const workStates = ['BUILDING', 'HARVESTING', 'MINING', 'STUDYING']
      if (workStates.includes(neighbor.state)) return

      const dx = entity.x - neighbor.x
      const dy = entity.y - neighbor.y
      const distSq = dx * dx + dy * dy

      const minSafeDist = (entity.collider?.radius || 10) + (neighbor.collider?.radius || 10)
      if (distSq < radius * radius && distSq > 0.01) {
        const dist = Math.sqrt(distSq)

        // 거리가 겹칠수록(minSafeDist보다 작을수록) 척력을 강화하되, 튀는 현상 방지를 위해 최대값 제한
        const force = Math.min(minSafeDist / dist, 5.0)
        repulsionX += (dx / dist) * force
        repulsionY += (dy / dist) * force
        count++
      }
    })

    if (count > 0) {
      repulsionX /= count
      repulsionY /= count
    }

    // 2) 가중치 합산 (기본 이동 벡터는 시스템에서 처리하므로 여기서는 척력 벡터만 반환하거나 합산 로직 제공)
    // 이 메소드는 시스템이 호출하여 자신의 'Target' 벡터와 합칩니다.
    return { x: repulsionX, y: repulsionY }
  }

  /**
   * 💡 [Phase 5] 군집(Boids) 행동 조향 벡터 (응집력 + 방향 일치)
   * 동일한 종의 동물들이 모여서 함께 이동하도록 유도합니다.
   */
  calculateFlockingVector(entity, neighbors) {
    const PACK_ANIMALS = ['WOLF', 'LION', 'SHEEP', 'COW', 'DEER', 'BOAR', 'ELEPHANT', 'MAMMOTH']
    const species = entity.species || entity.type
    if (!PACK_ANIMALS.includes(species)) return { x: 0, y: 0 }

    let cx = 0, cy = 0
    let vx = 0, vy = 0
    let count = 0

    neighbors.forEach(n => {
      if (n.id !== entity.id && !n.isDead && (n.species === species || n.type === species)) {
        const dx = n.x - entity.x
        const dy = n.y - entity.y
        const distSq = dx * dx + dy * dy

        // 120픽셀 반경 내의 동족만 군집으로 인식
        if (distSq > 0.01 && distSq < 14400) {
          cx += n.x
          cy += n.y
          vx += n._velocity?.x || 0
          vy += n._velocity?.y || 0
          count++
        }
      }
    })

    if (count > 0) {
      // Cohesion (응집): 무리의 중심점을 향하는 벡터
      let cohX = (cx / count) - entity.x
      let cohY = (cy / count) - entity.y
      const cohMag = Math.sqrt(cohX * cohX + cohY * cohY)
      if (cohMag > 0) { cohX /= cohMag; cohY /= cohMag }

      // Alignment (정렬): 무리의 평균 이동 방향
      let alignX = vx / count
      let alignY = vy / count
      const alignMag = Math.sqrt(alignX * alignX + alignY * alignY)
      if (alignMag > 0) { alignX /= alignMag; alignY /= alignMag }

      return { x: cohX * 0.4 + alignX * 0.6, y: cohY * 0.4 + alignY * 0.6 }
    }
    return { x: 0, y: 0 }
  }
}
