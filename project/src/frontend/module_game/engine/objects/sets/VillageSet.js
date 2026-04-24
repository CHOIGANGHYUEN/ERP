import { VillageActions } from '../action/VillageActions.js'
import { VillageRenders } from '../render/VillageRenders.js'

export const VillageSet = {
  actions: VillageActions,
  renders: VillageRenders,

  init: (village) => {
    // 초기화 로직 (필요 시)
  },

  update: (village, deltaTime, world) => {
    try {
      VillageActions.update(village, deltaTime, world)

      // [Optimization] 가용 주거지 캐시 갱신 (1초 주기)
      village.tickTimer += deltaTime
      if (village.tickTimer >= 1000) {
        village.availableHouses = village.buildings.filter(
          (b) => b.type === 'HOUSE' && b.isConstructed && b.occupants.length < b.capacity,
        )
        village.tickTimer = 0
      }
    } catch (e) {
      console.error(`[VillageSet Update Error] ID ${village?.id}:`, e)
    }
  },

  render: (village, ctx, world) => {
    try {
      VillageRenders.render(village, ctx, world)
    } catch (e) {
      console.error(`[VillageSet Render Error] ID ${village?.id}:`, e)
    }
  },
}
