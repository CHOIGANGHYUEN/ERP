import { TERRAIN_COST } from './TerrainSystem.js'
import { findPath, PATH_THROTTLED } from './PathSystem.js'

export class MovementSystem {
  constructor(di) {
    this.di = di
    this.pathfinder = null
    this.steer = null
  }

  update(deltaTime, world) {
    if (!this.pathfinder) {
      this.pathfinder = world.pathfinderService
      this.steer = world.steeringService
    }

    const terrain = (world.views && world.views.terrain) || world.terrain
    const cols = Math.ceil((world.width || 3200) / 16)
    const rows = Math.ceil((world.height || 3200) / 16)

    world.creatures.forEach(creature => {
      if (creature.isDead || !creature.movement.isMoving) return

      const m = creature.movement

      // 1) 지능형 경로 생성 (targetPos가 있을 때)
      if (m.path.length === 0 && creature.targetPos) {
        // 💡 [개선] PathSystem의 구식 함수 대신 PathfinderService 사용
        const path = this.pathfinder?.findPath(
          world,
          creature.x, creature.y,
          creature.targetPos.x, creature.targetPos.y
        )

        // 💡 [스로틀링 대응] 연산 한도 초과 시, 목적지를 지우지 않고 다음 틱에 다시 시도하도록 리턴만 수행
        if (path === 'THROTTLED') return

        if (Array.isArray(path) && path.length > 0) {
          m.path = path
          m.currentWaypointIndex = 0
        } else if (path !== 'FAILED') {
          // 아직 결론이 나지 않은 경우 대기
          return
        } else {
          // 💡 정밀 검사 결과 진짜로 갈 수 없는 곳(바다 한가운데 등)일 때만 목적지 해제
          creature.targetPos = null
          m.isMoving = false
          m.velocity = { x: 0, y: 0 }
          return
        }
      }

      if (m.path.length === 0) {
        m.isMoving = false
        return
      }

      // 2) 현재 타겟 노드 가져오기
      let targetNode = m.path[m.currentWaypointIndex]
      if (!targetNode) {
        m.isMoving = false
        return
      }

      let dx = targetNode.x - creature.x
      let dy = targetNode.y - creature.y
      let distSq = dx * dx + dy * dy
      const reachThreshold = 196 // 14px * 14px

      // 3) 웨이포인트 도달 및 전환 (즉시 다음 노드로 주행)
      if (distSq < reachThreshold) {
        m.currentWaypointIndex++
        if (m.currentWaypointIndex >= m.path.length) {
          creature.targetPos = null
          m.isMoving = false
          m.velocity = { x: 0, y: 0 }
          return
        }
        // 다음 노드로 즉시 갱신
        targetNode = m.path[m.currentWaypointIndex]
        dx = targetNode.x - creature.x
        dy = targetNode.y - creature.y
        distSq = dx * dx + dy * dy
      }

      // 4) 현재 위치 기반 속도 계산
      let speedMultiplier = 1.0
      const tx = Math.floor(creature.x / 16)
      const ty = Math.floor(creature.y / 16)
      if (terrain && tx >= 0 && tx < cols && ty >= 0 && ty < rows) {
        const t = terrain[ty * cols + tx]
        const cost = TERRAIN_COST[t] ?? 1.0
        speedMultiplier = (cost === Infinity) ? 0.1 : 1.0 / cost
      }

      // 5) 목표 방향 벡터 (Normalized)
      const dist = Math.sqrt(distSq)
      let desiredVx = dist > 0.1 ? (dx / dist) : 0
      let desiredVy = dist > 0.1 ? (dy / dist) : 0

      // 6) Steering (로컬 회피)
      if (this.steer && dist > 1) {
        const neighbors = world.chunkManager.query({
          x: creature.x - 30, y: creature.y - 30, width: 60, height: 60
        })
        const avoid = this.steer.calculateAvoidanceVector(creature, neighbors)
        desiredVx += avoid.x * 0.5
        desiredVy += avoid.y * 0.5
      }

      // 7) 관성 보간 (Inertial Smoothing)
      const smoothing = 0.3
      let vx = (creature.velocity?.x || 0) * (1 - smoothing) + desiredVx * smoothing
      let vy = (creature.velocity?.y || 0) * (1 - smoothing) + desiredVy * smoothing

      const mag = Math.sqrt(vx * vx + vy * vy)
      if (mag > 0.01) {
        vx /= mag
        vy /= mag
      }

      creature.velocity = { x: vx, y: vy }
      m.velocity = { x: vx, y: vy }

      // 8) 물리 이동 (Sliding Vector)
      const moveStep = m.speed * speedMultiplier * (deltaTime / 1000)
      let finalVx = vx
      let finalVy = vy

      if (terrain) {
        const isBlocked = (gx, gy) => {
          if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return true
          const type = terrain[gy * cols + gx]
          return TERRAIN_COST[type] === Infinity
        }

        const nextX = creature.x + finalVx * moveStep
        const nextY = creature.y + finalVy * moveStep
        const nextGX = Math.floor(nextX / 16)
        const nextGY = Math.floor(nextY / 16)
        const curGX = Math.floor(creature.x / 16)
        const curGY = Math.floor(creature.y / 16)

        let normalX = 0, normalY = 0, hit = false

        if (nextGX !== curGX && isBlocked(nextGX, curGY)) {
          normalX = -Math.sign(finalVx); hit = true
        }
        if (nextGY !== curGY && isBlocked(curGX, nextGY)) {
          normalY = -Math.sign(finalVy); hit = true
        }
        if (!hit && (nextGX !== curGX || nextGY !== curGY) && isBlocked(nextGX, nextGY)) {
          normalX = -Math.sign(finalVx); normalY = -Math.sign(finalVy)
          const nMag = Math.sqrt(normalX * normalX + normalY * normalY)
          if (nMag > 0) { normalX /= nMag; normalY /= nMag }
          hit = true
        }

        if (hit) {
          const dot = finalVx * normalX + finalVy * normalY
          if (dot < 0) {
            let slideVx = finalVx - dot * normalX
            let slideVy = finalVy - dot * normalY
            const sMag = Math.sqrt(slideVx * slideVx + slideVy * slideVy)
            if (sMag > 0.01) {
              finalVx = slideVx / sMag; finalVy = slideVy / sMag
            } else {
              finalVx = -normalY; finalVy = normalX
            }
          }
        }

        const fNextX = creature.x + finalVx * moveStep
        const fNextY = creature.y + finalVy * moveStep
        if (!isBlocked(Math.floor(fNextX / 16), curGY)) creature.x = fNextX
        if (!isBlocked(curGX, Math.floor(fNextY / 16))) creature.y = fNextY
      } else {
        creature.x += finalVx * moveStep
        creature.y += finalVy * moveStep
      }

      // 9) Transform 회전 업데이트
      if (creature.transform) {
        creature.transform.x = creature.x
        creature.transform.y = creature.y
        const targetRot = Math.atan2(vy, vx)
        const diff = targetRot - creature.transform.rotation
        creature.transform.rotation += Math.atan2(Math.sin(diff), Math.cos(diff)) * 0.35
        creature.rotation = creature.transform.rotation
      }
    })
  }

  updateEntity(entity, deltaTime, world) {}
}
