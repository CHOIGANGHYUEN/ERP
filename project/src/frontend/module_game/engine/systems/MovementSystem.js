export class MovementSystem {
  constructor(di) {
    this.di = di
    this.pathfinder = null
    this.steer = null
  }

  /**
   * ■ 4단계: 핵심 이동 처리 시스템 루프
   */
  update(deltaTime, world) {
    if (!this.pathfinder) {
      this.pathfinder = world.pathfinderService
      this.steer = world.steeringService
    }

    world.creatures.forEach(creature => {
      // 1) 이동 대상 필터링 (isMoving 플래그 중심)
      if (creature.isDead || !creature.movement.isMoving) return

      const m = creature.movement

      // 1.1) 경로 자동 생성 방어 로직: path가 비어있으면 직접 타겟으로 향하는 노드 생성
      if (m.path.length === 0) {
        if (creature.targetPos) {
          m.path = [{ x: creature.targetPos.x, y: creature.targetPos.y }]
          m.currentWaypointIndex = 0
        } else {
          m.isMoving = false
          return
        }
      }

      const target = m.path[m.currentWaypointIndex]
      
      if (!target) {
        m.isMoving = false
        return
      }

      // 2) 웨이포인트 도달 체크
      const dx = target.x - creature.x
      const dy = target.y - creature.y
      const distSq = dx * dx + dy * dy

      if (distSq < 25) { // 5픽셀(Threshold) 이내인가?
        m.currentWaypointIndex++
        if (m.currentWaypointIndex >= m.path.length) {
          m.isMoving = false
          m.velocity = { x: 0, y: 0 }
          return
        }
      }

      // 3) 지형 패널티 적용
      let speedMultiplier = 1.0
      if (world.views && world.views.terrain) {
        const tx = Math.floor(creature.x / 16)
        const ty = Math.floor(creature.y / 16)
        if (tx >= 0 && tx < 200 && ty >= 0 && ty < 200) {
          const t = world.views.terrain[ty * 200 + tx]
          switch (t) {
            case 1: speedMultiplier = 0.7; break; // 숲
            case 2: speedMultiplier = 0.4; break; // 늪/얕은 물
            case 3: speedMultiplier = 0.2; break; // 산맥(가로지를 경우)
            // 도로는 0번 타일 중 트래픽이 높은 곳 등으로 추가 가능
          }
        }
      }

      // 4) 최종 벡터 연산 및 좌표 이동 (Divide by zero 방지 및 정규화)
      const dist = Math.sqrt(distSq)
      let vx = dist > 0.1 ? (dx / dist) : 0
      let vy = dist > 0.1 ? (dy / dist) : 0

      // Steering (로컬 회피) 합산 (0.5 가중치)
      if (this.steer && dist > 1) {
        const neighbors = world.chunkManager.query({
          x: creature.x - 30, y: creature.y - 30,
          width: 60, height: 60
        })
        const avoid = this.steer.calculateAvoidanceVector(creature, neighbors)
        vx += avoid.x * 0.5
        vy += avoid.y * 0.5
      }

      // 벡터 정규화
      const mag = Math.sqrt(vx * vx + vy * vy)
      if (mag > 0) {
        vx /= mag
        vy /= mag
      }

      m.velocity = { x: vx, y: vy }

      // 좌표 이동
      const moveStep = m.speed * speedMultiplier * (deltaTime / 1000)
      creature.x += vx * moveStep
      creature.y += vy * moveStep

      // 엔티티 transform 데이터 동기화 (rotation 포함)
      if (creature.transform) {
        creature.transform.x = creature.x
        creature.transform.y = creature.y
        creature.transform.rotation = Math.atan2(vy, vx)
      }
    })
  }

  /**
   * 개체별로 시스템 업데이트 시 호출되던 레거시 훅 (필요 시 유지)
   */
  updateEntity(entity, deltaTime, world) {
    // 이제 update 루프에서 일괄 처리하므로 비워둠
  }
}
