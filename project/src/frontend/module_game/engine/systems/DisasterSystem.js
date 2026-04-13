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
      if (Math.random() < 0.1) {
        world.buildings.forEach((b) => {
          if (b.isConstructed && Math.random() < 0.05) b.isConstructed = false // 지진으로 파괴 (재건축 필요)
        })
      }
    }

    // 토네이도 업데이트
    this.tornadoes.forEach((t) => t.update(deltaTime, world))
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
