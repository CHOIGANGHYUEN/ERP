/**
 * 2D 그리드 기반 공간 분할 관리자 (고급 최적화 버전)
 * 정적(Static) 객체와 동적(Dynamic) 객체를 분리하여 연산량을 획기적으로 줄입니다.
 */
export class ChunkManager {
  constructor(worldWidth, worldHeight, chunkSize = 320) {
    this.chunkSize = chunkSize
    this.cols = Math.ceil(worldWidth / chunkSize)
    this.rows = Math.ceil(worldHeight / chunkSize)

    const totalChunks = this.cols * this.rows
    // 정적 레이어 (건물, 나무 등 - 거의 변하지 않음)
    this.staticChunks = Array.from({ length: totalChunks }, () => [])
    // 동적 레이어 (주민, 동물 등 - 매 프레임 위치 변동)
    this.dynamicChunks = Array.from({ length: totalChunks }, () => [])
  }

  /**
   * 동적 레이어만 비웁니다. 정적 레이어는 유지됩니다.
   */
  clear() {
    for (let i = 0; i < this.dynamicChunks.length; i++) {
      this.dynamicChunks[i].length = 0
    }
  }

  /**
   * 정적 레이어까지 모두 비웁니다. (맵 초기화 시 사용)
   */
  clearAll() {
    this.clear()
    for (let i = 0; i < this.staticChunks.length; i++) {
      this.staticChunks[i].length = 0
    }
  }

  insert(entity, isStatic = false) {
    if (entity.x === undefined || entity.y === undefined) return

    const col = Math.floor(entity.x / this.chunkSize)
    const row = Math.floor(entity.y / this.chunkSize)

    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      const targetChunks = isStatic ? this.staticChunks : this.dynamicChunks
      targetChunks[row * this.cols + col].push(entity)
    }
  }

  query(range) {
    const result = []
    const startCol = Math.max(0, Math.floor(range.x / this.chunkSize))
    const startRow = Math.max(0, Math.floor(range.y / this.chunkSize))
    const endCol = Math.min(this.cols - 1, Math.floor((range.x + range.width) / this.chunkSize))
    const endRow = Math.min(this.rows - 1, Math.floor((range.y + range.height) / this.chunkSize))

    for (let r = startRow; r <= endRow; r++) {
      const rowOffset = r * this.cols
      for (let c = startCol; c <= endCol; c++) {
        const idx = rowOffset + c
        // 정적 객체 추가
        const sChunk = this.staticChunks[idx]
        for (let i = 0; i < sChunk.length; i++) result.push(sChunk[i])
        // 동적 객체 추가
        const dChunk = this.dynamicChunks[idx]
        for (let i = 0; i < dChunk.length; i++) result.push(dChunk[i])
      }
    }
    return result
  }
}
