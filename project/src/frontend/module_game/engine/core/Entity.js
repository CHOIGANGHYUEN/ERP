import { TERRAIN_COST } from '../systems/TerrainSystem.js'

export class Entity {
  constructor(x, y, ...args) {
    this.init(x, y, ...args)
  }

  reset(x, y, ...args) {
    this.init(x, y, ...args)
  }

  init(x, y, ..._args) {
    this.id = Math.random().toString(36).substr(2, 9)
    this.x = x
    this.y = y
    this.isDead = false
    this.isActive = true
    this.size = 10
    this.color = '#ffffff'
  }

  update(_deltaTime, _world) { }
  render(_ctx, _timestamp, ..._args) { }

  die(_world) {
    this.isDead = true
  }

  getBoundingBox() {
    return {
      x: this.x - this.size / 2,
      y: this.y - this.size / 2,
      width: this.size,
      height: this.size
    }
  }

  distanceTo(obj) {
    const dx = obj.x - this.x
    const dy = obj.y - this.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 지정된 좌표로 이동 가능한지(콜리전)와 지형 패널티(speedMult) 반환
  checkCollision(world, targetX, targetY) {
    let finalSpeedMult = 1.0
    let canMove = true

    // 1. 지형 체크 (O(1) - 인덱스 접근)
    if (world.terrain) {
      const cols = world.width ? Math.max(1, Math.ceil(world.width / 16)) : 200
      const nextTileX = Math.floor(targetX / 16)
      const nextTileY = Math.floor(targetY / 16)

      if (nextTileX >= 0 && nextTileX < cols && nextTileY >= 0 && nextTileY < Math.ceil((world.height || 3200) / 16)) {
        const nextType = world.terrain[nextTileY * cols + nextTileX]
        const cost = TERRAIN_COST[nextType] ?? 1.0

        // 💡 [Phase 3] 생물 종(Species) 특성을 반영한 지형 제약 분기
        if (this.species === 'BIRD' || this.type === 'BIRD') {
          // 새(Bird)는 모든 지형의 장애물 판정을 무시하고 직공 비행 가능
          canMove = true
          finalSpeedMult = 1.0
        } else if (this.species === 'FISH' || this.type === 'FISH') {
          // 물고기는 바다/강(terrain >= 3)에서만 이동 가능
          if (nextType < 3) canMove = false
          else finalSpeedMult = 1.0
        } else {
          if (cost === Infinity) canMove = false
          else if (cost > 1.0) finalSpeedMult = 1.0 / cost
        }
      }
    }

    // [장애물 제거] 사용자 요청에 따라 건물(울타리 포함)은 더 이상 물리적 충돌체가 아님
    // 오직 지형(terrain)에 의한 이동 제한만 유지함

    return { canMove, finalSpeedMult }
  }

  moveToTarget(tx, ty, deltaTime, world, speedMult = 1.0) {
    const maxX = world.width || (world.canvas ? world.canvas.width : 3200)
    const maxY = world.height || (world.canvas ? world.canvas.height : 3200)

    tx = Math.max(0, Math.min(maxX, tx))
    ty = Math.max(0, Math.min(maxY, ty))

    const dx = tx - this.x
    const dy = ty - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 2 && this.speed) {
      // 💡 [Phase 4] 짐승 길(Game Trail) 형성 생태계 구축
      if (world.pathSystem) {
        const isAnimal = this.type === 'HERBIVORE' || this.type === 'CARNIVORE' || this.type === 'animal'
        const trafficAmount = isAnimal ? deltaTime * 0.005 : deltaTime * 0.02 // 동물은 인간보다 약한 트래픽(페로몬) 누적
        world.pathSystem.addTraffic(this.x, this.y, trafficAmount)
      }

      let dirX = dx / dist
      let dirY = dy / dist

      // 2. 길 가중치 조타
      if (world.pathSystem && dist > 50) {
        const lookAhead = 30
        const sampleL_x = this.x + (dirX * Math.cos(0.5) - dirY * Math.sin(0.5)) * lookAhead
        const sampleL_y = this.y + (dirX * Math.sin(0.5) + dirY * Math.cos(0.5)) * lookAhead
        const sampleR_x = this.x + (dirX * Math.cos(-0.5) - dirY * Math.sin(-0.5)) * lookAhead
        const sampleR_y = this.y + (dirX * Math.sin(-0.5) + dirY * Math.cos(-0.5)) * lookAhead

        const trafficL = world.pathSystem.getTraffic(sampleL_x, sampleL_y)
        const trafficR = world.pathSystem.getTraffic(sampleR_x, sampleR_y)

        if (trafficL > 50 || trafficR > 50) {
          const steerWeight = 0.3
          if (trafficL > trafficR) {
            dirX = dirX * (1 - steerWeight) + (sampleL_x - this.x) / lookAhead * steerWeight
            dirY = dirY * (1 - steerWeight) + (sampleL_y - this.y) / lookAhead * steerWeight
          } else {
            dirX = dirX * (1 - steerWeight) + (sampleR_x - this.x) / lookAhead * steerWeight
            dirY = dirY * (1 - steerWeight) + (sampleR_y - this.y) / lookAhead * steerWeight
          }
          const steerDist = Math.sqrt(dirX * dirX + dirY * dirY)
          dirX /= steerDist
          dirY /= steerDist
        }
      }
      let pathSpeedMult = 1.0
      if (world.pathSystem) {
        pathSpeedMult = world.pathSystem.getSpeedMult(this.x, this.y)
      }

      // 💡 [Phase 5] 군집(Flocking) 및 회피(Boids) 지능형 조향 적용
      if (world.steeringService && dist > 5) {
        const neighbors = world.chunkManager.query({
          x: this.x - 100, y: this.y - 100, width: 200, height: 200
        })

        const avoid = world.steeringService.calculateAvoidanceVector(this, neighbors)
        let flockX = 0, flockY = 0

        if (this.type === 'CARNIVORE' || this.type === 'HERBIVORE' || this.type === 'animal') {
          const flock = world.steeringService.calculateFlockingVector(this, neighbors)
          flockX = flock.x; flockY = flock.y
        }

        dirX = dirX * 0.4 + avoid.x * 0.7 + flockX * 0.5
        dirY = dirY * 0.4 + avoid.y * 0.7 + flockY * 0.5

        const newMag = Math.sqrt(dirX * dirX + dirY * dirY)
        if (newMag > 0) { dirX /= newMag; dirY /= newMag }
      }

      // 방향 일치(Alignment)를 위한 속도 메모리
      if (!this._velocity) this._velocity = { x: 0, y: 0 }
      this._velocity.x = dirX; this._velocity.y = dirY

      const moveStep = this.speed * speedMult * pathSpeedMult * (deltaTime * 0.06)
      const nextX = this.x + dirX * moveStep
      const nextY = this.y + dirY * moveStep

      // 3. Wall Sliding Collision
      const checkDiag = this.checkCollision(world, nextX, nextY)
      if (checkDiag.canMove) {
        this.x = nextX
        this.y = nextY
        return // 속도보정은 대각선일 때는 제외하거나 간단히 그대로 적용. (더 정확히 하려면 moveStep에 곱해줌)
      }

      // 대각선 이동 불가 시, X축과 Y축 독립 슬라이딩 시도
      const checkX = this.checkCollision(world, nextX, this.y)
      const checkY = this.checkCollision(world, this.x, nextY)

      let moved = false
      if (checkX.canMove) {
        this.x = nextX
        moved = true
      }
      if (checkY.canMove) {
        this.y = nextY
        moved = true
      }

      if (!moved) {
        // 💡 [Phase 2] 동물의 본능 상태별 맞춤형 회피 기동
        if (this.state === 'WANDERING') {
          // 배회 중: 벽을 만나면 튕겨 나가듯 반대쪽으로 랜덤하게 방향 틀기
          this.targetX = this.x + (Math.random() - 0.5) * 400
          this.targetY = this.y + (Math.random() - 0.5) * 400
        } else if (this.state === 'FLEEING') {
          // 도망 중: 막다른 길(산/바다)에 몰리면 반대/측면으로 필사적인 우회 도주
          this.targetX = this.x - dirX * 300 + (Math.random() - 0.5) * 200
          this.targetY = this.y - dirY * 300 + (Math.random() - 0.5) * 200
        } else if (this.state === 'HUNTING') {
          // 사냥 중: 장애물에 완벽히 막히면 A* 우회 탐색 플래그 활성화
          this._needsPathfinding = true
        } else {
          this.targetX = this.x
          this.targetY = this.y
          if (this.state === 'WANDERING') this.state = 'IDLE'
        }
      } else {
        // 이동 성공 시 길찾기 탐색 플래그 해제
        this._needsPathfinding = false
      }
    }
  }
}
