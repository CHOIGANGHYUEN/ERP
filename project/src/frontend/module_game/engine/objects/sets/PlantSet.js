import { PlantEmotion } from '../emotions/PlantEmotion.js'
import { PlantActions } from '../action/PlantActions.js'
import { PlantRenders } from '../renders/PlantRenders.js'

export const PlantSet = {
  emotion: PlantEmotion,
  action: PlantActions,
  render: PlantRenders,

  init: (plant) => {
    PlantEmotion.init(plant)
  },

  update: (plant, deltaTime, world) => {
    try {
      // 1. 식물 감정/환경 변수 업데이트 (비오면 수분 보충 등)
      PlantEmotion.update(plant, deltaTime, world)

      // 2. 프레임 단위 행동 업데이트 (GROWING 등)
      const actionObj = PlantActions[plant.state]
      if (actionObj && actionObj.execute) {
        actionObj.execute(plant, deltaTime, world)
      }
    } catch (e) {
      console.error(`[PlantSet Update Error] ID ${plant?.id}:`, e)
    }
  },

  draw: (plant, ctx, timestamp, windSpeed) => {
    try {
      const renderAction = PlantRenders[plant.state]
      if (renderAction) {
        renderAction(plant, ctx, timestamp, windSpeed)
      }
    } catch (e) {
      console.error(`[PlantSet Draw Error] ID ${plant?.id}:`, e)
    }
  },
}
