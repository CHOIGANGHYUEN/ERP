import { BuildingActions } from '../action/BuildingActions.js'
import { BuildingRenders } from '../render/BuildingRenders.js'

export const BuildingSet = {
  actions: BuildingActions,
  renders: BuildingRenders,

  init: (building) => {
    // 초기화 로직 (필요 시)
  },

  update: (building, deltaTime, world) => {
    try {
      BuildingActions.update(building, deltaTime, world)
    } catch (e) {
      console.error(`[BuildingSet Update Error] ID ${building?.id}:`, e)
    }
  },

  render: (building, ctx, world) => {
    try {
      BuildingRenders.render(building, ctx, world)
    } catch (e) {
      console.error(`[BuildingSet Render Error] ID ${building?.id}:`, e)
    }
  },
}
