export class TerrainSystem {
  constructor(width, height, tileSize) {
    this.width = width
    this.height = height
    this.tileSize = tileSize
    this.cols = Math.ceil(width / tileSize)
    this.rows = Math.ceil(height / tileSize)
  }

  // 간단한 파동 중첩(가짜 노이즈) 함수
  _getNoise(x, y, seed) {
    let nx = x / this.cols
    let ny = y / this.rows
    
    // 3 옥타브 합성 노이즈
    let e = 1 * this._noise(1 * nx, 1 * ny, seed)
          + 0.5 * this._noise(2 * nx, 2 * ny, seed + 10)
          + 0.25 * this._noise(4 * nx, 4 * ny, seed + 20)
    e = e / (1 + 0.5 + 0.25)
    
    // 거리에 기반한 중앙 마스킹 (섬 모양으로 만들기 위함)
    const cx = nx - 0.5
    const cy = ny - 0.5
    const d = Math.sqrt(cx * cx + cy * cy) * 2.0 // 0(중앙) ~ 1.4(구석)
    const mask = Math.max(0, 1.0 - Math.pow(d, 1.5))
    
    return e * mask
  }

  _noise(nx, ny, seed) {
    return (
      Math.sin(nx * 10 + seed) +
      Math.cos(ny * 10 + seed) +
      Math.sin((nx + ny) * 14 + seed) +
      Math.cos((nx - ny) * 14 + seed)
    ) / 4 + 0.5 // 0 ~ 1 범위 정규화
  }

  generateMap(terrainBufferArray) {
    const seed = Math.random() * 100
    for (let index = 0; index < this.cols * this.rows; index++) {
      const cx = index % this.cols
      const cy = Math.floor(index / this.cols)

      const elevation = this._getNoise(cx, cy, seed)

      if (elevation < 0.1) {
        terrainBufferArray[index] = 5 // ABYSS
      } else if (elevation < 0.25) {
        terrainBufferArray[index] = 4 // DEEP_SEA
      } else if (elevation < 0.35) {
        terrainBufferArray[index] = 3 // SHALLOW_SEA
      } else if (elevation < 0.65) {
        terrainBufferArray[index] = 0 // GRASS
      } else if (elevation < 0.75) {
        terrainBufferArray[index] = 1 // LOW_MOUNTAIN
      } else {
        terrainBufferArray[index] = 2 // HIGH_MOUNTAIN
      }
    }
  }

  setTerrainData(terrainData) {
    this.terrainData = terrainData
  }

  isObstacle(x, y) {
    if (!this.terrainData) return false

    const cx = Math.floor(x / this.tileSize)
    const cy = Math.floor(y / this.tileSize)

    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) {
      return true // 화면 밖이나 유효하지 않은 좌표는 이동 불가
    }

    const index = cy * this.cols + cx
    const tileType = this.terrainData[index]

    // 💡 TERRAIN_COST 참조하여 이동 비용이 무한(Infinity)인 곳은 장애물로 판별
    // 2: HIGH_MOUNTAIN, 4: DEEP_SEA, 5: ABYSS
    return TERRAIN_COST[tileType] === Infinity
  }
}

// 💡 [Cost Map] 지형별 A* 길찾기 비용 정의
export const TERRAIN_COST = {
  0: 1.0,      // GRASS: 표준 이동 (비용 1.0)
  1: 2.0,      // LOW_MOUNTAIN: 이동 효율 저하 (비용 2.0)
  2: Infinity, // HIGH_MOUNTAIN: 이동 불가
  3: Infinity, // SHALLOW_SEA: 이동 불가 (수정)
  4: Infinity, // DEEP_SEA: 이동 불가
  5: Infinity  // ABYSS: 이동 불가
}
