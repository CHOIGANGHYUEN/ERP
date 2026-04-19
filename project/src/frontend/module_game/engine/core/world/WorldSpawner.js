export const WorldSpawner = {
  // 프록시 기반 생성 통제
  spawnCreature: (world, x, y) => world.entitySpawnerSystem.spawnCreature(world, x, y),
  spawnAnimal: (world, x, y, type) => world.entitySpawnerSystem.spawnAnimal(world, x, y, type),
  spawnBuilding: (world, x, y, type, village) => world.entitySpawnerSystem.spawnBuilding(world, x, y, type, village),
  spawnPlant: (world, x, y, type) => world.entitySpawnerSystem.spawnPlant(world, x, y, type),
  removePlant: (world, plant) => world.entitySpawnerSystem.removePlant(world, plant),
  spawnResource: (world, x, y, type) => world.entitySpawnerSystem.spawnResource(world, x, y, type),
  removeResource: (world, resource) => world.entitySpawnerSystem.removeResource(world, resource),
  loadCreatures: (world, creaturesData) => world.entitySpawnerSystem.loadCreatures(world, creaturesData),
  initNature: (world) => world.entitySpawnerSystem.initNature(world),

  // 재난, 날씨, 통신 프록시
  spawnParticle: (world, x, y, config) => {
    if (!world.isHeadless) world.particleSystem.emit(x, y, config)
  },
  showSpeechBubble: (world, entityId, entityType, text, duration = 2000) => {
    if (world.isHeadless) {
      if (world.onEvent) world.onEvent({ type: 'SPEECH_BUBBLE', payload: { entityId, entityType, text, duration } })
    } else {
      world.interactionSystem.addBubble(entityId, entityType, text, duration)
    }
  },
  broadcastEvent: (world, text, color = '#f1c40f') => {
    if (world.isHeadless && world.onEvent) {
      world.onEvent({ type: 'SYSTEM_MESSAGE', payload: { text, color } })
    }
  },
  addFertility: (world, amount) => {
    if (!world.isHeadless && world.onProxyAction) return world.onProxyAction({ type: 'ADD_FERTILITY', payload: { amount } })
    world.currentFertility = Math.min(world.maxFertility, world.currentFertility + amount)
  },
  setWeather: (world, type) => {
    if (!world.isHeadless && world.onProxyAction) return world.onProxyAction({ type: 'SET_WEATHER', payload: { type } })
    world.weather.weatherType = type
    world.weather.weatherTimer = 20000
  },
  spawnTornado: (world, x, y) => {
    if (!world.isHeadless && world.onProxyAction) return world.onProxyAction({ type: 'SPAWN_TORNADO', payload: { x, y } })
    world.disasterSystem.spawnTornado(x, y)
  },
  triggerEarthquake: (world) => {
    if (!world.isHeadless && world.onProxyAction) return world.onProxyAction({ type: 'TRIGGER_EARTHQUAKE' })
    world.disasterSystem.triggerEarthquake()
  }
}
