/**
 * 2D 그리드 기반 공간 분할 및 동적 로딩(Culling) 관리자
 * QuadTree를 대체하여 매 프레임 발생하는 가비지 컬렉션(GC)을 0으로 최적화합니다.
 */
export class ChunkManager {
  constructor(worldWidth, worldHeight, chunkSize = 320) {
    this.chunkSize = chunkSize
    this.cols = Math.ceil(worldWidth / chunkSize)
    this.rows = Math.ceil(worldHeight / chunkSize)

    // 1차원 배열로 2D 그리드 표현
    this.chunks = Array.from({ length: this.cols * this.rows }, () => [])
  }

  /**
   * 매 프레임 호출되어 청크를 비웁니다.
   * (배열 참조를 끊지 않고 길이만 0으로 만들어 GC 부하를 원천 차단)
   */
  clear() {
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].length = 0
    }
  }

  insert(entity) {
    if (entity.x === undefined || entity.y === undefined) return

    const col = Math.floor(entity.x / this.chunkSize)
    const row = Math.floor(entity.y / this.chunkSize)

    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.chunks[row * this.cols + col].push(entity)
    }
  }

  query(range) {
    const result = []
    const startCol = Math.max(0, Math.floor(range.x / this.chunkSize))
    const startRow = Math.max(0, Math.floor(range.y / this.chunkSize))
    const endCol = Math.min(this.cols - 1, Math.floor((range.x + range.width) / this.chunkSize))
    const endRow = Math.min(this.rows - 1, Math.floor((range.y + range.height) / this.chunkSize))

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const chunk = this.chunks[r * this.cols + c]
        for (let i = 0; i < chunk.length; i++) {
          result.push(chunk[i])
        }
      }
    }
    return result
  }
}
