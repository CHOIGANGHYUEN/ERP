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
      if (neighbor.id === entity.id) return

      const dx = entity.x - neighbor.x
      const dy = entity.y - neighbor.y
      const distSq = dx * dx + dy * dy
      
      const minSafeDist = (entity.collider?.radius || 10) + (neighbor.collider?.radius || 10)
      
      if (distSq < radius * radius && distSq > 0.01) {
        const dist = Math.sqrt(distSq)
        
        // 거리가 겹칠수록(minSafeDist보다 작을수록) 척력을 기하급수적으로 강화
        const force = (minSafeDist / dist)
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
