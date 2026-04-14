// 시스템 전역에서 사용할 DI 토큰 정의 (심볼을 사용해 고유성 보장)
export const TOKENS = {
  WeatherSystem: Symbol('WeatherSystem'),
  TimeSystem: Symbol('TimeSystem'),
  CameraSystem: Symbol('CameraSystem'),
  DisasterSystem: Symbol('DisasterSystem'),
  DiplomacySystem: Symbol('DiplomacySystem'),
  EntitySystem: Symbol('EntitySystem'),
  RenderSystem: Symbol('RenderSystem'),
  PluginManager: Symbol('PluginManager'),
  SpriteManager: Symbol('SpriteManager'),
  ParticleSystem: Symbol('ParticleSystem'),
  LightingSystem: Symbol('LightingSystem'),
  InteractionSystem: Symbol('InteractionSystem'),
  VillageSystem: Symbol('VillageSystem'),
  BuildingSystem: Symbol('BuildingSystem'),
  BufferSyncSystem: Symbol('BufferSyncSystem'),
  EntitySpawnerSystem: Symbol('EntitySpawnerSystem'),
}
