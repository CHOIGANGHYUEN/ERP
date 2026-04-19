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
 * A* Pathfinding with safety limit (MAX_ITERATIONS)
 */
export function findPath(world, start, target) {
  const gridSize = 16;
  const cols = Math.ceil(world.width / gridSize);
  const rows = Math.ceil(world.height / gridSize);

  const startCoord = {
    x: Math.floor(start.x / gridSize),
    y: Math.floor(start.y / gridSize)
  };
  const targetCoord = {
    x: Math.floor(target.x / gridSize),
    y: Math.floor(target.y / gridSize)
  };

  const openSet = [startCoord];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  const posKey = (p) => `${p.x},${p.y}`;
  gScore.set(posKey(startCoord), 0);
  fScore.set(posKey(startCoord), heuristic(startCoord, targetCoord));

  let iterationCount = 0;
  const MAX_ITERATIONS = 500; // Safety limit to prevent freezes

  while (openSet.length > 0) {
    iterationCount++;
    if (iterationCount > MAX_ITERATIONS) {
      console.error('🚨 PathSystem 무한 루프 감지! 타겟에 도달할 수 없습니다:', target);
      return null;
    }

    // Get node in openSet with lowest fScore
    let current = openSet[0];
    let lowestF = fScore.get(posKey(current));
    let currentIndex = 0;

    for (let i = 1; i < openSet.length; i++) {
      const f = fScore.get(posKey(openSet[i]));
      if (f < lowestF) {
        lowestF = f;
        current = openSet[i];
        currentIndex = i;
      }
    }

    if (current.x === targetCoord.x && current.y === targetCoord.y) {
      return reconstructPath(cameFrom, current, gridSize);
    }

    openSet.splice(currentIndex, 1);

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= cols || neighbor.y < 0 || neighbor.y >= rows) continue;
      
      // Collision check
      if (world.terrain) {
        const type = world.terrain[neighbor.y * cols + neighbor.x];
        if (type === 2) continue; // HIGH_MOUNTAIN is blocking
      }

      const tentativeGScore = (gScore.get(posKey(current)) || 0) + 1;
      if (tentativeGScore < (gScore.get(posKey(neighbor)) || Infinity)) {
        cameFrom.set(posKey(neighbor), current);
        gScore.set(posKey(neighbor), tentativeGScore);
        const f = tentativeGScore + heuristic(neighbor, targetCoord);
        fScore.set(posKey(neighbor), f);
        
        if (!openSet.some(p => p.x === neighbor.x && p.y === neighbor.y)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return null;
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(cameFrom, current, gridSize) {
  const path = [];
  let curr = current;
  const posKey = (p) => `${p.x},${p.y}`;
  
  while (cameFrom.has(posKey(curr))) {
    path.push({ x: curr.x * gridSize + gridSize / 2, y: curr.y * gridSize + gridSize / 2 });
    curr = cameFrom.get(posKey(curr));
  }
  return path.reverse();
}
