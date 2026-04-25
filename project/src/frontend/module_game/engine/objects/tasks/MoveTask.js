import { BaseTask } from './BaseTask.js'
import { findPath, PATH_THROTTLED } from '../../systems/PathSystem.js'
import { TERRAIN_COST } from '../../systems/TerrainSystem.js'

export class MoveTask extends BaseTask {
  constructor(target, threshold = 10) {
    super('MOVE')
    this.target = target
    this.threshold = threshold
    this.startTime = Date.now()
    this.lastX = 0
    this.lastY = 0
    this.stuckTimer = 0
    this.moveState = 'DIRECT' // 💡 [Phase 4: FSM] 기본 이동 상태 신설
  }

  onEnter(creature, world) {
    if (!this.target || this.target.x === undefined) throw new Error('Invalid movement target')
    
    // 타겟 지향 렌더링을 위해 타겟 설정
    creature.target = this.target
    
    // 💡 [PathSystem A*] 기존 pathfinderService 대신 고도화된 PathSystem 직접 호출
    const path = findPath(world, { x: creature.x, y: creature.y }, this.target)

    if (path === PATH_THROTTLED) {
      this._initialized = false // 다음 틱에 다시 onEnter 시도
      return
    }

    if (!path) {
      // 💡 [안정성] 길찾기 실패 시 에러를 던지지 않고 타스크를 종료 (AI가 다른 타겟 시도)
      // 중복 로그 방지를 위해 3초에 한 번만 출력
      const now = Date.now()
      if (!creature._lastFailLog || now - creature._lastFailLog > 3000) {
        let terrainInfo = ''
        if (world.terrain) {
          const gridSize = 16
          const cols = Math.ceil((world.width || 3200) / gridSize)
          const sX = Math.floor(creature.x / gridSize), sY = Math.floor(creature.y / gridSize)
          const tX = Math.floor(this.target.x / gridSize), tY = Math.floor(this.target.y / gridSize)
          const startType = world.terrain[sY * cols + sX]
          const targetType = world.terrain[tY * cols + tX]
          terrainInfo = ` (StartTerrain: ${startType}, TargetTerrain: ${targetType})`
        }

        console.warn(`[MoveTask] Pathfinding failed for creature ${creature.id}. Target: (${this.target.x.toFixed(1)}, ${this.target.y.toFixed(1)})${terrainInfo}`)
        creature._lastFailLog = now
      }

      creature.state = 'IDLE'
      this.status = 'FAILED'
      return
    }

    if (Array.isArray(path) && path.length === 0) {
      // 💡 이미 목표지점에 도달한 상태 (성공) - 로그 노이즈 제거
      this.status = 'COMPLETED'
      return
    }

    // 💡 [Waypoint System] MoveTask가 모든 경로를 소유
    this.path = path
    // MovementSystem에는 단기 목표(1칸)만 부여하여 물리엔진(디더링/회전)을 활용
    creature.movement.path = [this.path[0]]
    creature.movement.currentWaypointIndex = 0
    creature.movement.isMoving = true
    creature.state = 'MOVING' // 적극적인 이동 상태로 변경
  }

  // 💡 [Phase 2: Forward Raycasting] 전방 탐지 센서 모듈
  // 현재 이동 방향(Vector)을 기준으로 전방 N 픽셀 앞의 타일 속성을 확인
  _checkForwardSensor(creature, world, lookAheadDist = 24) {
    if (!creature.velocity) return false
    const vx = creature.velocity.x || 0
    const vy = creature.velocity.y || 0
    if (vx === 0 && vy === 0) return false

    // 현재 이동 방향을 기준으로 전방 좌표 계산 (Raycasting)
    const checkX = creature.x + vx * lookAheadDist
    const checkY = creature.y + vy * lookAheadDist

    const gridSize = 16
    const cols = Math.ceil((world.width || 3200) / gridSize)
    const rows = Math.ceil((world.height || 3200) / gridSize)
    const cx = Math.floor(checkX / gridSize)
    const cy = Math.floor(checkY / gridSize)

    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return true // 맵 밖은 장애물

    let isBlocked = false

    // 1. TerrainSystem의 isObstacle을 활용 (또는 직접 지형 판별)
    if (world.terrainSystem && world.terrainSystem.isObstacle) {
      isBlocked = world.terrainSystem.isObstacle(checkX, checkY)
    } else if (world.terrain) {
      const type = world.terrain[cy * cols + cx]
      if (TERRAIN_COST[type] === Infinity) isBlocked = true
    }

    // 2. 동적 장애물 판별
    if (!isBlocked && world.pathSystem && world.pathSystem.obstacles) {
      if (world.pathSystem.obstacles[cy * cols + cx] === 1) isBlocked = true
    }

    return isBlocked
  }

  onRunning(creature, deltaTime, world) {
    if (this.isPathFailed) return 'FAILED' // 길찾기 실패 상태면 즉시 중단

    // 타임아웃 20초 방어
    if (Date.now() - this.startTime > 20000) {
      console.log(`[MoveTask] Timeout for creature ${creature.id}. Target: (${this.target.x}, ${this.target.y})`)
      return 'FAILED'
    }

    // 💡 [Phase 2 & 4: FSM 상태 전환] 매 프레임 전방 장애물 탐지 및 상태 제어
    const isObstacleAhead = this._checkForwardSensor(creature, world, 24)
    
    if (isObstacleAhead) {
      if (this.moveState !== 'AVOIDING') {
        this.moveState = 'AVOIDING'
      }
    } else {
      if (this.moveState !== 'DIRECT') {
        this.moveState = 'DIRECT'
      }
    }

    creature._moveState = this.moveState // 외부에 FSM 상태 노출
    creature._sensorHit = (this.moveState === 'AVOIDING') // 3단계(MovementSystem) 연동

    // 도달 체크: MovementSystem이 물리적으로 해당 Waypoint에 8픽셀 이내로 도달해 isMoving을 반납했을 때
    if (!creature.movement.isMoving || creature.movement.currentWaypointIndex >= creature.movement.path.length) {
      // 💡 [Waypoint Shift] 달성한 노드를 버림
      if (this.path && this.path.length > 0) {
        this.path.shift()
      }

      // 더 이상 경로가 없으면 최종 확인 후 완료
      if (!this.path || this.path.length === 0) {
        const dist = creature.distanceTo(this.target)
        const range = this.threshold // WorkSystem 등에서 미리 target.size를 포함하여 계산해 줌
        return (dist <= range + 5) ? 'COMPLETED' : 'FAILED' // 부동소수점 여유 5px
      }

      // 다음 이동할 노드
      const nextNode = this.path[0]

      // 💡 [Stuck Detection] 1초 동안 이동 거리가 미미하면(끼임 현상) 경로 재탐색
      const movedDist = Math.sqrt(Math.pow(creature.x - this.lastX, 2) + Math.pow(creature.y - this.lastY, 2))
      if (movedDist < 2) {
        this.stuckTimer += deltaTime
      } else {
        this.stuckTimer = 0
      }
      this.lastX = creature.x
      this.lastY = creature.y

      // 💡 [Dynamic Re-pathing] 다음 노드가 장애물(건물)이거나 이동 불가 지형(바다)인 경우
      const gridSize = 16
      const cols = Math.ceil((world.width || 3200) / gridSize)
      const checkX = Math.floor(nextNode.x / gridSize)
      const checkY = Math.floor(nextNode.y / gridSize)
      
      let isPathBlocked = false
      if (world.terrain) {
        const type = world.terrain[checkY * cols + checkX]
        if (TERRAIN_COST[type] === Infinity) isPathBlocked = true
      }
      if (!isPathBlocked && world.pathSystem && world.pathSystem.obstacles) {
        if (world.pathSystem.obstacles[checkY * cols + checkX] === 1) isPathBlocked = true
      }

      if (isPathBlocked || this.stuckTimer > 1000) {
        // 목표지점에 거의 다 온 것이 아니라면 재탐색 (막혔거나 끼었을 때)
        if (Math.abs(checkX - Math.floor(this.target.x / gridSize)) > 1 || 
            Math.abs(checkY - Math.floor(this.target.y / gridSize)) > 1) {
          
          this.stuckTimer = 0 // 타이머 초기화
          const newPath = findPath(world, { x: creature.x, y: creature.y }, this.target)
          if (!newPath || newPath === PATH_THROTTLED) {
            // 재탐색 실패 시 잠시 대기 후 나중에 다시 시도하게 하거나 실패 처리
            return 'RUNNING' 
          }
          this.path = newPath
          if (this.path.length === 0) return 'FAILED'
        }
      }

      if (this.isPathFailed && (!this.path || this.path.length === 0)) {
        return 'FAILED'
      }

      // 💡 [Step 3 로직 수행] 새로운 최상단 노드로 목적지 갱신
      creature.movement.path = [this.path[0]]
      creature.movement.currentWaypointIndex = 0
      creature.movement.isMoving = true
      creature.state = 'MOVING'
    }

    return 'RUNNING'
  }

  onFailed(creature, world, reason) {
    creature.movement.isMoving = false
    creature.movement.path = []
    this.path = []
    creature.target = null
  }
}
