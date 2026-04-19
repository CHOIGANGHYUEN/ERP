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
