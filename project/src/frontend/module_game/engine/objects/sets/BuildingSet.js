import { BuildingActions } from '../action/BuildingActions.js'
import { BuildingRenders } from '../render/BuildingRenders.js'

export const BuildingSet = {
  actions: BuildingActions,
  renders: BuildingRenders,

  init: (building) => {
    // 초기화 로직 (필요 시)
  },

  update: (building, deltaTime, world) => {
    BuildingActions.update(building, deltaTime, world)
  },

  render: (building, ctx, world) => {
    BuildingRenders.render(building, ctx, world)
  }
}
