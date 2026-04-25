import { TERRAIN_COST } from './TerrainSystem.js'

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

  const startCoord = findNearestValidTile(world, Math.floor(start.x / gridSize), Math.floor(start.y / gridSize), cols, rows)
  const targetCoord = findNearestValidTile(world, Math.floor(target.x / gridSize), Math.floor(target.y / gridSize), cols, rows)

  if (!startCoord || !targetCoord) {
    // 도저히 근처에서 유효한 타일을 찾을 수 없는 경우 (심해 한가운데 등)
    pathFailCache.set(`${Math.floor(start.x/16)},${Math.floor(start.y/16)}->${Math.floor(target.x/16)},${Math.floor(target.y/16)}`, now)
    return null
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
  const MAX_ITERATIONS = 4000 // 💡 [안정화] 탐색 한도를 4000으로 대폭 상향 (맵 전체 탐색 능력 강화)

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

    // 💡 [8방향 탐색] 상하좌우 + 대각선 4방향 추가
    const neighbors = [
      { x: current.x + 1, y: current.y, cost: 1.0, isDiag: false },
      { x: current.x - 1, y: current.y, cost: 1.0, isDiag: false },
      { x: current.x, y: current.y + 1, cost: 1.0, isDiag: false },
      { x: current.x, y: current.y - 1, cost: 1.0, isDiag: false },
      // 대각선 (비용: √2 ≒ 1.414)
      { x: current.x + 1, y: current.y + 1, cost: 1.414, isDiag: true, side1: {x: 1, y: 0}, side2: {x: 0, y: 1} },
      { x: current.x - 1, y: current.y + 1, cost: 1.414, isDiag: true, side1: {x: -1, y: 0}, side2: {x: 0, y: 1} },
      { x: current.x + 1, y: current.y - 1, cost: 1.414, isDiag: true, side1: {x: 1, y: 0}, side2: {x: 0, y: -1} },
      { x: current.x - 1, y: current.y - 1, cost: 1.414, isDiag: true, side1: {x: -1, y: 0}, side2: {x: 0, y: -1} },
    ]

    const currentG = gScore.get(posKey(current))

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= cols || neighbor.y < 0 || neighbor.y >= rows) continue

      // 💡 [결함 방어] 대각선 이동 시 사이 타일이 벽이면 통과 불가 (Corner Clipping 방지)
      if (neighbor.isDiag) {
        const s1Type = world.terrain ? world.terrain[(current.y + neighbor.side1.y) * cols + (current.x + neighbor.side1.x)] : 0
        const s2Type = world.terrain ? world.terrain[(current.y + neighbor.side2.y) * cols + (current.x + neighbor.side2.x)] : 0
        const isS1Wall = (TERRAIN_COST[s1Type] === Infinity)
        const isS2Wall = (TERRAIN_COST[s2Type] === Infinity)
        
        // 동적 장애물(건물) 체크
        let isS1Obs = false, isS2Obs = false
        if (world.pathSystem && world.pathSystem.obstacles) {
          isS1Obs = world.pathSystem.obstacles[(current.y + neighbor.side1.y) * cols + (current.x + neighbor.side1.x)] === 1
          isS2Obs = world.pathSystem.obstacles[(current.y + neighbor.side2.y) * cols + (current.x + neighbor.side2.x)] === 1
        }
        
        if ((isS1Wall || isS1Obs) && (isS2Wall || isS2Obs)) continue // 양쪽이 막히면 대각선 통과 불가
      }

      // 💡 [Cost Map] 지형 정보에 따른 이동 비용 차등 연산
      let terrainCost = neighbor.cost // 기본 비용 (1.0 or 1.414)
      if (world.terrain) {
        const type = world.terrain[neighbor.y * cols + neighbor.x]
        const costWeight = TERRAIN_COST[type] ?? 1.0
        if (costWeight === Infinity) continue // 💡 [장애물 판정] 이동 불가 지형은 제외
        terrainCost *= costWeight // 지형 가중치 곱산
      }

      // 💡 [Dynamic Collision] 생성된 동적 충돌 맵 적용 (건물 등)
      if (world.pathSystem && world.pathSystem.obstacles) {
        if (world.pathSystem.obstacles[neighbor.y * cols + neighbor.x] === 1) {
          if (Math.abs(neighbor.x - targetCoord.x) > 1 || Math.abs(neighbor.y - targetCoord.y) > 1) {
            continue
          }
        }
      }

      // 💡 [Phase 5: Path Integration] 누적된 우회로(Pheromone)를 반영하여 비용 절감
      if (world.pathSystem && world.pathSystem.paths) {
        // neighbor는 그리드 좌표이므로 gridSize를 곱해줌
        const traffic = world.pathSystem.getTraffic(neighbor.x * gridSize, neighbor.y * gridSize)
        if (traffic > 50) {
          // 트래픽이 높을수록 길찾기 비용 감소 (최대 0.5 감소, 페로몬 유도)
          const discount = Math.min(0.5, traffic / 2000)
          terrainCost = Math.max(0.1, terrainCost - discount)
        }
      }

      // g(n) = 현재까지 실제 비용(currentG) + 이동할 타일의 지형 비용(terrainCost)
      const tentativeGScore = currentG + terrainCost
      const neighborKey = posKey(neighbor)

      if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
        cameFrom.set(neighborKey, current)
        gScore.set(neighborKey, tentativeGScore)
        
        // 💡 [Octile Heuristic] 8방향 이동에 최적화된 예상 잔여 비용
        const h = heuristic(neighbor, targetCoord)
        // f(n) = g(n) + h(n) * 1.001 (미세한 타이브레이커 추가로 직선 주행 유도)
        const f = tentativeGScore + h * 1.001
        pq.enqueue(f, neighbor)
      }
    }
  }

  pathFailCache.set(cacheKey, now) // 길을 끝까지 찾지 못한 경우 캐시 등록
  return null
}

function heuristic(a, b) {
  // Octile Distance: 8방향 최적 휴리스틱
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  const D = 1.0
  const D2 = 1.414
  return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy)
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

/**
 * 💡 [지능형 스냅] 시작/목표 지점이 바다나 건물 내부일 경우, 주변 3x3 영역에서 가장 가까운 육지 타일을 찾습니다.
 */
function findNearestValidTile(world, gx, gy, cols, rows) {
  const isPosValid = (x, y) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return false
    if (world.terrain) {
      const type = world.terrain[y * cols + x]
      if (TERRAIN_COST[type] === Infinity) return false
    }
    if (world.pathSystem && world.pathSystem.obstacles) {
      if (world.pathSystem.obstacles[y * cols + x] === 1) return false
    }
    return true
  }

  if (isPosValid(gx, gy)) return { x: gx, y: gy }

  // 주변 8방향(1칸 거리) 우선 검색
  for (let r = 1; r <= 5; r++) { // 💡 검색 범위를 5칸(80px)까지 대폭 확장
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const nx = gx + dx, ny = gy + dy
        if (isPosValid(nx, ny)) return { x: nx, y: ny }
      }
    }
  }
  return null
}
