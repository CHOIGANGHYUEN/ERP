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

  update(_deltaTime, _world) {}
  render(_ctx, _timestamp, ..._args) {}

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
        if (nextType === 2) canMove = false
        else if (nextType === 1) finalSpeedMult = 0.5
        else if (nextType >= 3) finalSpeedMult = 0.3 // 수영 시 감속
      }
    }

    // 2. 주변 건물(울타리 등) 체크 (O(K) - 공간 분할 쿼리)
    if (canMove && world.chunkManager) {
      const range = {
        x: targetX - 50,
        y: targetY - 50,
        width: 100,
        height: 100
      }
      const nearby = world.chunkManager.query(range, 'static')
      const radius = (this.size / 2)
      
      for (let i = 0; i < nearby.length; i++) {
        const b = nearby[i]
        if (b._type !== 'building' || !b.isConstructed) continue
        
        // 울타리 계열인 경우 충돌 체크
        if (b.type === 'FENCE' || b.type === 'FENCE_GATE') {
          if (b.type === 'FENCE_GATE' && !b.isLocked && this.profession !== undefined) continue
          
          // Math.sqrt 대신 제곱 거리 비교 (성능 최적화)
          const dx = b.x - targetX
          const dy = b.y - targetY
          const distSq = dx * dx + dy * dy
          const minDist = radius + (b.size / 2)
          if (distSq < minDist * minDist) {
            canMove = false
            break
          }
        }
      }
    }
    
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
      // 1. 발걸음이 닿은 곳에 페로몬(Traffic) 추가
      if (world.pathSystem) {
        world.pathSystem.addTraffic(this.x, this.y, deltaTime * 0.02)
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

      // 💡 [Local Avoidance] 근처 유닛들과의 뭉침 방지 (Repulsion)
      // 매 프레임 모든 개체를 검사하면 무거우므로 chunkManager를 활용해 주변 반경 16내 동적 객체만 대상
      if (world.chunkManager && world.tick % 2 === 0) {
        const nearby = world.chunkManager.query({
          x: this.x - 16, y: this.y - 16, width: 32, height: 32
        }, 'dynamic')
        
        let repelX = 0
        let repelY = 0
        for (let i = 0; i < nearby.length; i++) {
          const other = nearby[i]
          if (other === this || other.isDead || other.type !== this.type) continue
          const rx = this.x - other.x
          const ry = this.y - other.y
          const rDist = Math.sqrt(rx * rx + ry * ry)
          // 8px 이하로 붙으면 강한 밀어내기 힘 적용
          if (rDist > 0 && rDist < 8) {
            repelX += (rx / rDist) * (8 - rDist)
            repelY += (ry / rDist) * (8 - rDist)
          }
        }
        
        if (repelX !== 0 || repelY !== 0) {
          dirX += repelX * 0.3
          dirY += repelY * 0.3
          const len = Math.sqrt(dirX * dirX + dirY * dirY)
          dirX /= len
          dirY /= len
        }
      }

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
        // 완벽히 막혔을 경우 제자리걸음 방지목적의 Target 리셋
        this.targetX = this.x
        this.targetY = this.y
        if (this.state === 'WANDERING') {
           this.state = 'IDLE'
        }
      }
    }
  }
}
