import { TERRAIN_COST } from './TerrainSystem.js'
import { findPath } from './PathSystem.js'

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

      // 💡 [지능형 경로 자동 생성] 
      // 경로가 비어있는데 목표 지점(targetPos)이 설정되어 있다면 MovementSystem이 자동으로 길을 찾습니다.
        if (m.path.length === 0 && creature.targetPos) {
          const path = findPath(
            world,
            { x: creature.x, y: creature.y },
            { x: creature.targetPos.x, y: creature.targetPos.y }
          )

        if (path && path.length > 0) {
          m.path = path
          m.currentWaypointIndex = 0
        } else {
          // 길찾기 실패 시 목표 제거 및 이동 중단
          creature.targetPos = null
          m.isMoving = false
          m.velocity = { x: 0, y: 0 }
          return
        }
      }

      // 최종적으로 경로가 없으면 이동 중단
      if (m.path.length === 0) {
        m.isMoving = false
        m.velocity = { x: 0, y: 0 }
        return
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
          creature.targetPos = null // 💡 도착 완료 시 목적지 초기화
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
        const cost = TERRAIN_COST[t] ?? 1.0
        if (cost === Infinity) {
          speedMultiplier = 0.1 // 💡 [물리엔진 보정] 시스템 상으론 차단되었더라도, 관성이나 충돌 버그로 밀려났을 때 빠져나오기 위한 최소 극저항
        } else {
          speedMultiplier = 1.0 / cost // 예: 비용이 2.0이면 이동속도 0.5 (절반)
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

      // 💡 [Phase 3: Sliding Vector Calculation] 슬라이딩 벡터 수학 모델 적용
      const moveStep = m.speed * speedMultiplier * (deltaTime / 1000)
      let intendedVx = vx
      let intendedVy = vy

      if (terrain) {
        const pathSys = world.pathSystem
        const isBlocked = (gx, gy) => {
          if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return true
          // 1. 지형 체크 (바다, 높은 산 등)
          const type = terrain[gy * cols + gx]
          if (TERRAIN_COST[type] === Infinity) return true
          // 2. 동적 장애물 체크 (건물 등)
          if (pathSys && pathSys.obstacles && pathSys.obstacles[gy * cols + gx] === 1) {
            // 크리처가 현재 있는 칸이 이미 장애물 안이라면 빠져나오는 것은 허용 (갇힘 방지)
            const curGX = Math.floor(creature.x / 16)
            const curGY = Math.floor(creature.y / 16)
            if (gx === curGX && gy === curGY) return false
            return true
          }
          return false
        }

        const checkX = creature.x + intendedVx * moveStep
        const checkY = creature.y + intendedVy * moveStep
        const nextGX = Math.floor(checkX / 16)
        const nextGY = Math.floor(checkY / 16)
        const curGX = Math.floor(creature.x / 16)
        const curGY = Math.floor(creature.y / 16)

        let normalX = 0
        let normalY = 0
        let hit = false

        // 1) 장애물 감지 시 해당 타일 경계면의 법선(Normal) 벡터 계산
        if (nextGX !== curGX && isBlocked(nextGX, curGY)) {
          normalX = -Math.sign(intendedVx)
          hit = true
        }
        if (nextGY !== curGY && isBlocked(curGX, nextGY)) {
          normalY = -Math.sign(intendedVy)
          hit = true
        }
        // 모서리 충돌
        if (!hit && (nextGX !== curGX || nextGY !== curGY) && isBlocked(nextGX, nextGY)) {
          normalX = -Math.sign(intendedVx)
          normalY = -Math.sign(intendedVy)
          const nMag = Math.sqrt(normalX * normalX + normalY * normalY)
          if (nMag > 0) {
            normalX /= nMag
            normalY /= nMag
          }
          hit = true
        }

        // Phase 2에서 감지된 전방 탐지 센서 결합
        if (!hit && creature._sensorHit) {
          const lookAheadX = creature.x + intendedVx * 24
          const lookAheadY = creature.y + intendedVy * 24
          const lookGX = Math.floor(lookAheadX / 16)
          const lookGY = Math.floor(lookAheadY / 16)
          
          if (isBlocked(lookGX, curGY)) normalX = -Math.sign(intendedVx)
          if (isBlocked(curGX, lookGY)) normalY = -Math.sign(intendedVy)
          if (normalX === 0 && normalY === 0) {
            normalX = -Math.sign(intendedVx)
            normalY = -Math.sign(intendedVy)
          }
          const nMag = Math.sqrt(normalX * normalX + normalY * normalY)
          if (nMag > 0) {
            normalX /= nMag
            normalY /= nMag
          }
          hit = true
        }

        if (hit) {
          // 2) 유닛의 기존 목표 방향 벡터에서 법선 성분을 투영(Dot Product)하여 제거
          const dotProduct = intendedVx * normalX + intendedVy * normalY

          // 장애물을 향해 돌진하고 있을 때만 슬라이딩 적용
          if (dotProduct < 0) {
            // 3) 남은 접선(Tangent) 벡터를 새로운 이동 방향으로 설정 (V_slide = V - (V · N) * N)
            let slideVx = intendedVx - dotProduct * normalX
            let slideVy = intendedVy - dotProduct * normalY
            
            const sMag = Math.sqrt(slideVx * slideVx + slideVy * slideVy)
            if (sMag > 0.01) {
              intendedVx = slideVx / sMag
              intendedVy = slideVy / sMag
            } else {
              intendedVx = 0
              intendedVy = 0
            }
          }
        }

        // 계산된 접선 벡터(Sliding Vector)로 최종 위치 도출
        const finalNextX = creature.x + intendedVx * moveStep
        const finalNextY = creature.y + intendedVy * moveStep
        const finalGX = Math.floor(finalNextX / 16)
        const finalGY = Math.floor(finalNextY / 16)

        // 부드러운 우회를 위한 AABB Fallback 안전장치 통합
        if (!isBlocked(finalGX, curGY)) creature.x = finalNextX
        if (!isBlocked(curGX, finalGY)) creature.y = finalNextY

        // 💡 [Phase 5: Path Integration] 우회 성공 시 해당 궤적에 트래픽(페로몬) 누적
        if (creature._moveState === 'AVOIDING' && world.pathSystem) {
          // 자연스러운 생태계 형성을 위해 프레임당 소량의 페로몬 배출
          world.pathSystem.addTraffic(creature.x, creature.y, 2)
        }

      } else {
        // 지형 정보가 없을 때만 단순 이동 (Fallback)
        creature.x += intendedVx * moveStep
        creature.y += intendedVy * moveStep
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
