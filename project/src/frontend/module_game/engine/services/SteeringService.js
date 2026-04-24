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
      // [Hotfix] 회피 대상 필터링 최적화: 살아있는 기동 개체(Creature, Animal)만 서로 피함
      // 그 외의 모든 정적 오브젝트(건물, 자원, 식생, 광산 등)는 조향 회피 대상에서 제외
      const targetType = neighbor._type || neighbor.type
      const isMobile = targetType === 'creature' || targetType === 'animal'
      
      if (!isMobile || neighbor.id === entity.id || (entity.target && neighbor.id === entity.target.id)) return
      
      // 작업 중인 개체(Building, Harvesting 등)는 피하는 대상에서 제외 (추가 고정 효과)
      const workStates = ['BUILDING', 'HARVESTING', 'MINING', 'STUDYING', 'REPAIRING']
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
}
