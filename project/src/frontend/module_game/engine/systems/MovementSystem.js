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

      if (distSq < 64) { // 8픽셀(Threshold) 이내인가?
        m.currentWaypointIndex++
        if (m.currentWaypointIndex >= m.path.length) {
          m.isMoving = false
          m.velocity = { x: 0, y: 0 }
          return
        }
      }

      // 3) 지형 기반 이동 속도 및 이동 제한 (TerrainSystem 인덱스 준수)
      let speedMultiplier = 1.0
      const terrain = (world.views && world.views.terrain) || world.terrain

      const cols = Math.ceil((world.width || 3200) / 16)
      const rows = Math.ceil((world.height || 3200) / 16)
      const tx = Math.floor(creature.x / 16)
      const ty = Math.floor(creature.y / 16)
      if (terrain && tx >= 0 && tx < cols && ty >= 0 && ty < rows) {
        const t = terrain[ty * cols + tx]
        if (Math.random() < 0.005) {
          console.log(`[MovementSystem] Creature ${creature.id} at (${tx}, ${ty}) terrain: ${t}`);
        }
        switch (t) {
          case 1: speedMultiplier = 0.6; break; // 낮은 산 (속도 저하)
          case 2: case 3: case 4: case 5:
            speedMultiplier = 0.1; break; // 높은 산/물 진입 시 극도의 저항 (사실상 차단)
        }
      }

      // 4) [Inertial Smoothing] 속도 벡터 보간 (갑작스러운 방향 전환 방지 및 부드러운 코너링)
      const dist = Math.sqrt(distSq)
      const desiredVx = dist > 0.1 ? (dx / dist) : 0
      const desiredVy = dist > 0.1 ? (dy / dist) : 0

      // Steering (로컬 회피) 합산
      let steerX = 0, steerY = 0
      if (this.steer && dist > 1) {
        const neighbors = world.chunkManager.query({
          x: creature.x - 30, y: creature.y - 30,
          width: 60, height: 60
        })
        const avoid = this.steer.calculateAvoidanceVector(creature, neighbors)
        steerX = avoid.x * 0.5
        steerY = avoid.y * 0.5
      }

      // 최종 목표 벡터
      const finalTargetVx = desiredVx + steerX
      const finalTargetVy = desiredVy + steerY

      // [Smooth Step] 이전 프레임의 실제 속도와 현재 목표 속도를 보간 (관성 효과)
      const smoothing = 0.3 // 유연하면서도 즉각적인 반응성 확보 (0.15 -> 0.3)
      let vx = (creature.velocity?.x || 0) * (1 - smoothing) + finalTargetVx * smoothing
      let vy = (creature.velocity?.y || 0) * (1 - smoothing) + finalTargetVy * smoothing

      // 벡터 정규화
      const mag = Math.sqrt(vx * vx + vy * vy)
      if (mag > 0.01) {
        vx /= mag
        vy /= mag
      }

      // 다음 프레임을 위한 가속도 데이터 보존
      creature.velocity = { x: vx, y: vy }
      m.velocity = { x: vx, y: vy }

      // 💡 [지형 충돌 판정] 성분별 이동 시도를 통해 해안선을 따라 흐르듯 이동(Sliding)하게 함
      const moveStep = m.speed * speedMultiplier * (deltaTime / 1000)
      const nextX = creature.x + vx * moveStep
      const nextY = creature.y + vy * moveStep

      if (terrain) {
        // 1. X축 이동 시도
        const nextGX = Math.floor(nextX / 16)
        const currentGY = Math.floor(creature.y / 16)
        let tX = 0 // 기본 평지로 가정
        if (nextGX >= 0 && nextGX < cols && currentGY >= 0 && currentGY < rows) {
          tX = terrain[currentGY * cols + nextGX]
        }
        if (tX === 0 || tX === 1) {
          creature.x = nextX
        }

        // 2. Y축 이동 시도
        const currentGX = Math.floor(creature.x / 16)
        const nextGY = Math.floor(nextY / 16)
        let tY = 0 // 기본 평지로 가정
        if (currentGX >= 0 && currentGX < cols && nextGY >= 0 && nextGY < rows) {
          tY = terrain[nextGY * cols + currentGX]
        }
        if (tY === 0 || tY === 1) {
          creature.y = nextY
        }
      } else {
        // 지형 정보가 없을 때만 단순 이동 (Fallback)
        creature.x = nextX
        creature.y = nextY
      }

      // 6) Transform 동기화 (Lerp를 통한 회전 부드럽게)
      if (creature.transform) {
        creature.transform.x = creature.x
        creature.transform.y = creature.y
        const targetRot = Math.atan2(vy, vx)
        const diff = targetRot - creature.transform.rotation
        
        // 각도 차이 정규화 (-PI ~ PI)
        const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff))
        
        // 💡 [Responsiveness] 회전 보정 속도 증가 (0.15 -> 0.35) 하여 이동 방향과 렌더링 방향 일치성 강화
        creature.transform.rotation += normalizedDiff * 0.35
        creature.rotation = creature.transform.rotation // 속성 일치성 확보
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
