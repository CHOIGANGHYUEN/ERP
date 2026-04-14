import { DIContainer } from '../container/DIContainer.js'
import { TOKENS } from '../tokens/index.js'

import { WeatherSystem } from '../../engine/systems/WeatherSystem.js'
import { TimeSystem } from '../../engine/systems/TimeSystem.js'
import { Camera } from '../../engine/systems/Camera.js'
import { DisasterSystem } from '../../engine/systems/DisasterSystem.js'
import { PluginManager } from '../../engine/core/PluginManager.js'
import { SpriteManager } from '../../engine/systems/SpriteManager.js'
import { ParticleSystem } from '../../engine/systems/ParticleSystem.js'
import { LightingSystem } from '../../engine/systems/LightingSystem.js'
import { InteractionSystem } from '../../engine/systems/InteractionSystem.js'
import { VillageSystem } from '../../engine/systems/VillageSystem.js'
import { BuildingSystem } from '../../engine/systems/BuildingSystem.js'
import { BufferSyncSystem } from '../../engine/systems/BufferSyncSystem.js'
import { EntitySpawnerSystem } from '../../engine/systems/EntitySpawnerSystem.js'
import { EntitySystem } from '../../engine/systems/EntitySystem.js'
import { RenderSystem } from '../../engine/systems/RenderSystem.js'

/**
 * 시스템 전역 의존성 주입 컨테이너를 설정하고 반환합니다.
 * GameView.vue에서 World 객체 생성 시 주입되어 활용됩니다.
 */
export function setupDI() {
  const container = new DIContainer()

  // 각 분리된 모듈들을 Singleton 단위로 컨테이너에 등록합니다.
  container.register(TOKENS.WeatherSystem, WeatherSystem)
  container.register(TOKENS.TimeSystem, TimeSystem)
  // 카메라는 캔버스 크기에 따라 가변적으로 생성되므로 싱글톤 패턴을 해제합니다.
  container.register(TOKENS.CameraSystem, Camera, { singleton: false })
  container.register(TOKENS.DisasterSystem, DisasterSystem)
  container.register(TOKENS.PluginManager, PluginManager)
  container.register(TOKENS.SpriteManager, SpriteManager)
  container.register(TOKENS.ParticleSystem, ParticleSystem)
  container.register(TOKENS.LightingSystem, LightingSystem, { singleton: false })
  container.register(TOKENS.InteractionSystem, InteractionSystem)
  container.register(TOKENS.VillageSystem, VillageSystem)
  container.register(TOKENS.BuildingSystem, BuildingSystem)
  container.register(TOKENS.BufferSyncSystem, BufferSyncSystem)
  container.register(TOKENS.EntitySpawnerSystem, EntitySpawnerSystem)
  container.register(TOKENS.EntitySystem, EntitySystem)
  container.register(TOKENS.RenderSystem, RenderSystem)

  return container
}
