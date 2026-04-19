import { Tornado } from '../objects/environment/Tornado.js'

export class DisasterSystem {
  constructor() {
    this.earthquakeTimer = 0
    this.tornadoes = []
  }

  update(deltaTime, world) {
    // 지진 업데이트 및 파괴 연산
    if (this.earthquakeTimer > 0) {
      this.earthquakeTimer -= deltaTime
      
      // [Optimization] 모든 건물을 매 프레임 순회(O(N))하는 대신, 무작위 샘플링 검사로 부하 분산
      const buildingCount = world.buildings.length
      if (buildingCount > 0) {
        const samplesPerFrame = Math.min(buildingCount, 10) // 프레임당 최대 10개만 검사
        for (let i = 0; i < samplesPerFrame; i++) {
          const b = world.buildings[Math.floor(Math.random() * buildingCount)]
          if (b && b.isConstructed && Math.random() < 0.01) {
             b.isConstructed = false // 지진 대미지로 파손
          }
        }
      }
    }

    // [Optimization] 토네이도 업데이트 (역순 루프로 안전한 제거 지원)
    for (let i = this.tornadoes.length - 1; i >= 0; i--) {
      const t = this.tornadoes[i]
      t.update(deltaTime, world)
      
      // 토네이도 수명 종료 시 Swap-and-Pop 제거
      if (t.isDead) {
        this.tornadoes[i] = this.tornadoes[this.tornadoes.length - 1]
        this.tornadoes.pop()
      }
    }
  }

  spawnTornado(x, y) {
    this.tornadoes.push(new Tornado(x, y))
  }

  triggerEarthquake() {
    this.earthquakeTimer = 5000 // 5초간 지진
  }

  applyCameraShake(ctx) {
    if (this.earthquakeTimer > 0) {
      const shakeX = (Math.random() - 0.5) * 15
      const shakeY = (Math.random() - 0.5) * 15
      ctx.translate(shakeX, shakeY)
    }
  }
}
