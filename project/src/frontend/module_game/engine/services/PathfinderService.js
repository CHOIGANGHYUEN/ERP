export const PATH_FAILED = 'FAILED'
export const PATH_THROTTLED = 'THROTTLED'

export class PathfinderService {
  constructor() {
    this.gridSize = 16
    this.maxNodes = 10000 // 3) 탐색 한도 10배 상향 (만 단위)
  }

  /**
   * ■ 2단계: 글로벌 경로 탐색 서비스 (A*)
   * 픽셀 좌표를 입력받아 스무딩된 경로 배열을 반환합니다.
   */
  findPath(world, startX, startY, targetX, targetY) {
    // 1) 그리드 변환
    const startXG = Math.floor(startX / this.gridSize)
    const startYG = Math.floor(startY / this.gridSize)
    const targetXG = Math.floor(targetX / this.gridSize)
    const targetYG = Math.floor(targetY / this.gridSize)

    if (startXG === targetXG && startYG === targetYG) return [{ x: targetX, y: targetY }]

    const openList = []
    const closedList = new Uint8Array(200 * 200)
    const parentMap = new Map()

    const startNode = { x: startXG, y: startYG, g: 0, h: this._getHeuristic(startXG, startYG, targetXG, targetYG) }
    startNode.f = startNode.g + startNode.h
    openList.push(startNode)

    let nodesSearched = 0

    while (openList.length > 0) {
      nodesSearched++
      if (nodesSearched > this.maxNodes) return PATH_THROTTLED

      // F값이 가장 작은 노드 선택
      let currentIndex = 0
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[currentIndex].f) currentIndex = i
      }
      const current = openList.splice(currentIndex, 1)[0]
      const currentIdx = current.y * 200 + current.x
      closedList[currentIdx] = 1

      if (current.x === targetXG && current.y === targetYG) {
        return this._reconstructPath(world, parentMap, current, targetX, targetY)
      }

      // 인접 8방향 탐색
      const neighbors = [
        { x: current.x + 1, y: current.y, cost: 1 },
        { x: current.x - 1, y: current.y, cost: 1 },
        { x: current.x, y: current.y + 1, cost: 1 },
        { x: current.x, y: current.y - 1, cost: 1 },
        { x: current.x + 1, y: current.y + 1, cost: 1.414 },
        { x: current.x - 1, y: current.y - 1, cost: 1.414 },
        { x: current.x + 1, y: current.y - 1, cost: 1.414 },
        { x: current.x - 1, y: current.y + 1, cost: 1.414 }
      ]

      for (const neighbor of neighbors) {
        if (neighbor.x < 0 || neighbor.x >= 200 || neighbor.y < 0 || neighbor.y >= 200) continue
        const nIdx = neighbor.y * 200 + neighbor.x
        if (closedList[nIdx]) continue

        // 이동 가능 여부 체크 (성능을 위해 미리 선별)
        if (!this._isWalkable(world, neighbor.x, neighbor.y)) continue

        // 지형에 따른 추가 가중치 (낮은 산: 5.0배)
        let terrainMultiplier = 1.0
        if (world.views && world.views.terrain) {
           const t = world.views.terrain[nIdx]
           if (t === 1) terrainMultiplier = 5.0
        }

        const gScore = current.g + neighbor.cost * terrainMultiplier
        const existingNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y)

        if (!existingNode || gScore < existingNode.g) {
          const hScore = this._getHeuristic(neighbor.x, neighbor.y, targetXG, targetYG)
          const node = { x: neighbor.x, y: neighbor.y, g: gScore, h: hScore, f: gScore + hScore }
          parentMap.set(nIdx, currentIdx)
          if (!existingNode) openList.push(node)
          else {
            existingNode.g = gScore
            existingNode.f = gScore + hScore
          }
        }
      }
    }

    return PATH_FAILED
  }

  _getHeuristic(x1, y1, x2, y2) {
    // 체비쇼프 거리 (대각선 허용 시 적합)
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2))
  }

  _isWalkable(world, gx, gy) {
    if (!world.views || !world.views.terrain) return true
    const tidx = gy * 200 + gx
    
    // 지형 체크 (물, 산맥 등)
    const t = world.views.terrain[tidx]
    if (t === 3 || t === 2 || t >= 4) return false

    // [REMOVED] 건물 충돌은 더 이상 길찾기에 영향을 주지 않음

    return true
  }

  _reconstructPath(world, parentMap, endNode, targetX, targetY) {
    const rawPath = []
    let currentIdx = endNode.y * 200 + endNode.x
    
    while (currentIdx !== undefined) {
      const x = (currentIdx % 200) * this.gridSize + this.gridSize / 2
      const y = Math.floor(currentIdx / 200) * this.gridSize + this.gridSize / 2
      rawPath.unshift({ x, y })
      currentIdx = parentMap.get(currentIdx)
    }

    // 마지막 노드는 정확한 타겟 좌표로 보정
    if (rawPath.length > 0) {
      rawPath[rawPath.length - 1] = { x: targetX, y: targetY }
    }

    return this.smoothPath(world, rawPath)
  }

  /**
   * 4) 경로 스무딩 (Raycast 기반 String Pulling)
   */
  smoothPath(world, path) {
    if (path.length <= 2) return path

    const smoothed = [path[0]]
    let currentIdx = 0

    while (currentIdx < path.length - 1) {
      let furthestVisibleIdx = currentIdx + 1
      
      // 다음 분기점들 중 가시성이 확보된 가장 먼 곳을 찾음
      for (let i = currentIdx + 2; i < path.length; i++) {
        if (this._isLineOfSightClear(world, path[currentIdx], path[i])) {
          furthestVisibleIdx = i
        } else {
          // 중간에 막히면 그 이전까지는 직선으로 이어질 수 있음
          // 최적화를 위해 여기서 break
          break
        }
      }
      
      smoothed.push(path[furthestVisibleIdx])
      currentIdx = furthestVisibleIdx
    }

    return smoothed
  }

  _isLineOfSightClear(world, start, end) {
    // Bresenham's line algorithm 기반 그리드 가시성 레이캐스팅
    let x0 = Math.floor(start.x / this.gridSize)
    let y0 = Math.floor(start.y / this.gridSize)
    const x1 = Math.floor(end.x / this.gridSize)
    const y1 = Math.floor(end.y / this.gridSize)

    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx - dy

    while (x0 !== x1 || y0 !== y1) {
      if (!this._isWalkable(world, x0, y0)) return false
      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x0 += sx
      }
      if (e2 < dx) {
        err += dx
        y0 += sy
      }
    }
    return true
  }
}
