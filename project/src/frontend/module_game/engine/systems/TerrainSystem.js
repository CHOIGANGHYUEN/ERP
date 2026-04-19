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

      let type = 0 // GRASS
      if (elevation < 0.1) {
        type = 5 // ABYSS
      } else if (elevation < 0.25) {
        type = 4 // DEEP_SEA
      } else if (elevation < 0.35) {
        type = 3 // SHALLOW_SEA
      } else if (elevation < 0.65) {
        type = 0 // GRASS
      } else if (elevation < 0.75) {
        type = 1 // LOW_MOUNTAIN
      } else {
        type = 2 // HIGH_MOUNTAIN
      }

      terrainBufferArray[index] = type
    }
  }
}
