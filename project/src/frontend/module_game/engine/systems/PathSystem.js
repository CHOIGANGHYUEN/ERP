// 💡 [프리징 방어] 도달 불가능한 경로 스팸 요청 차단을 위한 캐시 맵
const pathFailCache = new Map()
let lastCacheCleanup = Date.now()

// 💡 [최적화] 프레임당 최대 길찾기 호출 수 제한 (Throttling)
let globalPathCallCount = 0
let lastGlobalTick = 0
const MAX_GLOBAL_PATH_CALLS_PER_TICK = 30 // 한 틱(약 16ms) 동안 최대 30회만 정밀 길찾기 허용

// 💡 [프리징 방어] 스로틀링 발생 시 경로 없음(null)과 구분하기 위한 상수
export const PATH_THROTTLED = Symbol('PATH_THROTTLED')

export class PathSystem {
  constructor() {
    this.width = 3200
    this.height = 3200
    this.gridSize = 16
    this.cols = Math.ceil(this.width / this.gridSize) // 200
    this.rows = Math.ceil(this.height / this.gridSize) // 200
    this.paths = null // Float32Array
    this.decayTimer = 0
    this.currentDecayIndex = 0 // 분산 처리를 위한 인덱스

    // [New] Dynamic Obstacles
    this.obstacles = new Uint8Array(this.cols * this.rows)
    this.obstacleUpdateTimer = 0
  }

  initSharedState(world) {
    if (world.views && world.views.paths) {
      this.paths = world.views.paths
    }
  }

  _getIndex(x, y) {
    const col = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.gridSize)))
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.gridSize)))
    return row * this.cols + col
  }

  /**
   * 보행 마찰로 인한 트래픽(페로몬) 추가.
   */
  addTraffic(x, y, amount) {
    if (!this.paths) return
    const idx = this._getIndex(x, y)
    // 1000이 최대 트래픽(완전한 돌길)
    this.paths[idx] = Math.min(1000, this.paths[idx] + amount)
  }

  getTraffic(x, y) {
    if (!this.paths) return 0
    const idx = this._getIndex(x, y)
    return this.paths[idx]
  }

  /**
   * 해당 좌표의 길 다져짐 정보에 따른 속도 보너스
   */
  getSpeedMult(x, y) {
    const traffic = this.getTraffic(x, y)
    if (traffic > 500) return 1.3 // 다져진 길
    if (traffic > 100) return 1.15 // 흙길
    return 1.0 // 일반 땅
  }

  /**
   * 매 프레임 조금씩 경로 데이터를 감쇄시켜 연산 스파이크를 방지합니다.
   */
  update(deltaTime, world) {
    if (!this.paths) return

    // 40,000개의 셀을 한 번에 처리하지 않고 프레임당 약 200개씩 분산 처리
    // 약 3.3초(200프레임)마다 맵 전체가 1회 업데이트됨
    const cellsToUpdate = 200
    const totalCells = this.paths.length

    for (let i = 0; i < cellsToUpdate; i++) {
      const idx = this.currentDecayIndex
      if (this.paths[idx] > 0) {
        if (this.paths[idx] >= 800) {
          this.paths[idx] = Math.max(0, this.paths[idx] - 0.1) // 굳어진 길은 매우 느리게 감쇄
        } else {
          this.paths[idx] = Math.max(0, this.paths[idx] - 0.5) // 일반 길은 상대적으로 빠르게 감쇄
        }
      }

      this.currentDecayIndex = (this.currentDecayIndex + 1) % totalCells
    }

    // 💡 [Dynamic Collision Map] 1초에 한 번 동적 오브젝트(건물 등)를 충돌 맵에 렌더링
    if (world) {
      this.obstacleUpdateTimer += deltaTime
      if (this.obstacleUpdateTimer >= 1000) {
        this.obstacleUpdateTimer = 0
        this.obstacles.fill(0)
        
        // 건물들을 순회하며 공간을 1로 마킹
        world.buildings.forEach((b) => {
          if (!b.x || !b.y || !b.size) return
          // 건물 중심에서 사이즈 절반만큼 영역 차지
          const halfSize = (b.size / 2) * 0.8 // 약간의 여유(0.8)를 두어 옆으로 지나갈 수 있게 함
          const startX = Math.max(0, Math.floor((b.x - halfSize) / this.gridSize))
          const endX = Math.min(this.cols - 1, Math.ceil((b.x + halfSize) / this.gridSize))
          const startY = Math.max(0, Math.floor((b.y - halfSize) / this.gridSize))
          const endY = Math.min(this.rows - 1, Math.ceil((b.y + halfSize) / this.gridSize))
          
          for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
              this.obstacles[y * this.cols + x] = 1
            }
          }
        })
      }
    }
  }
}

/**
 * A simple Priority Queue implementation for A* optimization
 */
class PriorityQueue {
  constructor() {
    this.nodes = []
  }
  enqueue(priority, key) {
    this.nodes.push({ priority, key })
    this.bubbleUp()
  }
  dequeue() {
    if (this.nodes.length === 0) return null
    if (this.nodes.length === 1) return this.nodes.pop()
    const top = this.nodes[0]
    this.nodes[0] = this.nodes.pop()
    this.sinkDown()
    return top
  }
  bubbleUp() {
    let index = this.nodes.length - 1
    while (index > 0) {
      let parentIndex = Math.floor((index - 1) / 2)
      if (this.nodes[parentIndex].priority <= this.nodes[index].priority) break
      ;[this.nodes[parentIndex], this.nodes[index]] = [this.nodes[index], this.nodes[parentIndex]]
      index = parentIndex
    }
  }
  sinkDown() {
    let index = 0
    while (true) {
      let left = 2 * index + 1
      let right = 2 * index + 2
      let smallest = index
      if (left < this.nodes.length && this.nodes[left].priority < this.nodes[smallest].priority)
        smallest = left
      if (right < this.nodes.length && this.nodes[right].priority < this.nodes[smallest].priority)
        smallest = right
      if (smallest === index) break
      ;[this.nodes[smallest], this.nodes[index]] = [this.nodes[index], this.nodes[smallest]]
      index = smallest
    }
  }
  isEmpty() {
    return this.nodes.length === 0
  }
}

/**
 * A* Pathfinding with safety limit (MAX_ITERATIONS)
 * Optimized version with Priority Queue
 */
export function findPath(world, start, target) {
  // 💡 [최적화] 글로벌 호출 횟수 체크 (부하 분산)
  const currentTick = Math.floor(Date.now() / 16) // 약 60FPS 기준 틱 구분
  if (currentTick !== lastGlobalTick) {
    globalPathCallCount = 0
    lastGlobalTick = currentTick
  }

  if (globalPathCallCount >= MAX_GLOBAL_PATH_CALLS_PER_TICK) {
    // 이번 틱의 연산 한도 초과 시 PATH_THROTTLED 반환하여 나중에 다시 시도하게 함
    return PATH_THROTTLED
  }
  globalPathCallCount++

  // 💡 [최적화] 10초마다 길찾기 실패 캐시를 주기적으로 비워줌
  const now = Date.now()
  if (now - lastCacheCleanup > 10000) {
    pathFailCache.clear()
    lastCacheCleanup = now
  }

  const gridSize = 16
  const cols = Math.ceil(world.width / gridSize)
  const rows = Math.ceil(world.height / gridSize)

  const startCoord = {
    x: Math.floor(start.x / gridSize),
    y: Math.floor(start.y / gridSize),
  }
  const targetCoord = {
    x: Math.floor(target.x / gridSize),
    y: Math.floor(target.y / gridSize),
  }

  // 💡 [프리징 원천 차단] 2초 이내에 길찾기에 실패했던 동일한 경로면 연산 없이 즉시 null 반환 (호출 스팸 방어)
  const cacheKey = `${startCoord.x},${startCoord.y}->${targetCoord.x},${targetCoord.y}`
  if (pathFailCache.has(cacheKey) && now - pathFailCache.get(cacheKey) < 2000) {
    return null
  }

  const pq = new PriorityQueue()
  const cameFrom = new Map()
  const gScore = new Map()
  const posKey = (p) => `${p.x},${p.y}`

  const startKey = posKey(startCoord)
  gScore.set(startKey, 0)
  pq.enqueue(heuristic(startCoord, targetCoord), startCoord)

  let iterationCount = 0
  const MAX_ITERATIONS = 500 // Performance limit for real-time simulation

  while (!pq.isEmpty()) {
    iterationCount++
    if (iterationCount > MAX_ITERATIONS) {
      pathFailCache.set(cacheKey, now) // 실패 캐시 등록
      return null // 💡 [프리징 방지] 콘솔 로그 폭탄 없이 조용히 실패(null) 처리
    }

    const { key: current } = pq.dequeue()

    if (current.x === targetCoord.x && current.y === targetCoord.y) {
      const path = reconstructPath(cameFrom, current, gridSize)
      if (path === null) {
        pathFailCache.set(cacheKey, now)
      }
      return path
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]

    const currentG = gScore.get(posKey(current))

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= cols || neighbor.y < 0 || neighbor.y >= rows) continue

      // Terrain Collision
      if (world.terrain) {
        const type = world.terrain[neighbor.y * cols + neighbor.x]
        if (type >= 2) continue // HIGH_MOUNTAIN and SEA blocking
      }

      // 💡 [Dynamic Collision] 생성된 동적 충돌 맵 적용
      if (world.pathSystem && world.pathSystem.obstacles) {
        if (world.pathSystem.obstacles[neighbor.y * cols + neighbor.x] === 1) {
          // 목표지점이 바로 장애물 안에 있는 경우는 도착을 허용해야 함
          // (예: 목적지가 집 중심인 경우 집 주변 1칸은 열어줌)
          if (Math.abs(neighbor.x - targetCoord.x) > 1 || Math.abs(neighbor.y - targetCoord.y) > 1) {
            continue
          }
        }
      }

      const tentativeGScore = currentG + 1
      const neighborKey = posKey(neighbor)

      if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
        cameFrom.set(neighborKey, current)
        gScore.set(neighborKey, tentativeGScore)
        const f = tentativeGScore + heuristic(neighbor, targetCoord)
        pq.enqueue(f, neighbor)
      }
    }
  }

  pathFailCache.set(cacheKey, now) // 길을 끝까지 찾지 못한 경우 캐시 등록
  return null
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function reconstructPath(cameFrom, current, gridSize) {
  const path = []
  let curr = current
  const posKey = (p) => `${p.x},${p.y}`

  let safetyCount = 0
  while (cameFrom.has(posKey(curr))) {
    if (safetyCount++ > 2000) {
      return null // 💡 [프리징 방지] 망가진 경로 배열을 반환하지 않고 즉시 완전한 실패(null) 처리
    }
    path.push({ x: curr.x * gridSize + gridSize / 2, y: curr.y * gridSize + gridSize / 2 })
    curr = cameFrom.get(posKey(curr))
  }
  return path.reverse()
}
