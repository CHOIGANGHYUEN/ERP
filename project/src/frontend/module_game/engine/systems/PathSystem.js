// 💡 [프리징 방어] 도달 불가능한 경로 스팸 요청 차단을 위한 캐시 맵
const pathFailCache = new Map()
let lastCacheCleanup = Date.now()

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
  update(deltaTime) {
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
        if (type === 2) continue // HIGH_MOUNTAIN blocking
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
