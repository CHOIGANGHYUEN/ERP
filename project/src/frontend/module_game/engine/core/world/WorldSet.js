import { WorldUpdater } from './WorldUpdater.js'
import { WorldInteractor } from './WorldInteractor.js'
import { WorldSpawner } from './WorldSpawner.js'

export const WorldSet = {
  updater: WorldUpdater,
  interactor: WorldInteractor,
  spawner: WorldSpawner,

  init: (world) => {
    // 필요한 초기화 델리게이션이 있다면 이곳을 사용
  },

  update: (world, deltaTime) => {
    WorldUpdater.update(world, deltaTime)
  },

  getEntityAt: (world, worldX, worldY) => {
    return WorldInteractor.getEntityAt(world, worldX, worldY)
  }
}
