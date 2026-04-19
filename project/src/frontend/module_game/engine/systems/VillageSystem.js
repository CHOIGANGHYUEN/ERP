import { MarketSystem } from '../systems/MarketSystem.js'

export class VillageSystem {
  constructor() {
    this.marketSystem = new MarketSystem()
  }

  update(deltaTime, world) {
    // 요약: 모든 비즈니스 로직은 이제 VillageSet/VillageActions로 이관되었습니다.
    // 1. 시장 시스템 (글로벌 교역) 업데이트
    this.marketSystem.update(deltaTime, world)

    // 2. 각 마을 업데이트 (뇌 위임)
    world.villages.forEach((v) => {
      v.update(deltaTime, world)
    })
  }
}
