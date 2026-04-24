import { TOKENS } from '../../di/tokens/index.js'
import { ChunkManager } from '../systems/ChunkManager.js'
import { TerrainSystem } from '../systems/TerrainSystem.js'
import { createSharedBuffers } from './SharedState.js'
import { WorldSet } from './world/WorldSet.js'
import { Logger } from '../utils/Logger.js'

export class World {
  constructor(di, canvas, isHeadless = false, sharedBuffers = null) {
    this.di = di
    this.isHeadless = isHeadless
    this.canvas = canvas

    this.width = 3000
    this.height = 3000

    this.weather = this.di.resolve(TOKENS.WeatherSystem, this.width, this.height)
    this.timeSystem = this.di.resolve(TOKENS.TimeSystem)
    this.disasterSystem = this.di.resolve(TOKENS.DisasterSystem)
    this.pluginManager = this.di.resolve(TOKENS.PluginManager)
    this.spriteManager = this.di.resolve(TOKENS.SpriteManager)
    this.particleSystem = this.di.resolve(TOKENS.ParticleSystem)
    this.lightingSystem = this.di.resolve(TOKENS.LightingSystem, this.width, this.height)
    this.interactionSystem = this.di.resolve(TOKENS.InteractionSystem)
    this.villageSystem = this.di.resolve(TOKENS.VillageSystem)
    this.buildingSystem = this.di.resolve(TOKENS.BuildingSystem)
    this.bufferSyncSystem = this.di.resolve(TOKENS.BufferSyncSystem)
    this.entitySpawnerSystem = this.di.resolve(TOKENS.EntitySpawnerSystem)
    this.entitySystem = this.di.resolve(TOKENS.EntitySystem)
    this.renderSystem = this.di.resolve(TOKENS.RenderSystem)
    this.pathSystem = this.di.resolve(TOKENS.PathSystem)
    this.eventBusService = this.di.resolve(TOKENS.EventBusService)
    this.blacklistService = this.di.resolve(TOKENS.BlacklistService)
    this.taskBoardService = this.di.resolve(TOKENS.TaskBoardService)
    this.utilityScoringService = this.di.resolve(TOKENS.UtilityScoringService)
    this.pathfinderService = this.di.resolve(TOKENS.PathfinderService)
    this.steeringService = this.di.resolve(TOKENS.SteeringService)
    this.movementSystem = this.di.resolve(TOKENS.MovementSystem, this.di)
    this.behaviorSystem = this.di.resolve(TOKENS.BehaviorSystem, this.di)
    this.perceptionSystem = this.di.resolve(TOKENS.PerceptionSystem, this.di)
    this.workSystem = this.di.resolve(TOKENS.WorkSystem, this.di)

    if (!this.isHeadless && canvas) {
      this.ctx = canvas.getContext('2d')
      this.camera = this.di.resolve(TOKENS.CameraSystem, canvas.width, canvas.height, this.width, this.height)
    } else {
      this.camera = { x: 0, y: 0, zoom: 1, width: 800, height: 400 }
    }

    this.settings = {
      showTerritory: true,
      showVillageArea: false,
      showGrid: false,
    }

    if (sharedBuffers) {
      this.initSharedState(sharedBuffers)
    } else if (isHeadless) {
      this.sharedBuffers = createSharedBuffers()
      this.initSharedState(this.sharedBuffers)
    }
    
    this.pathSystem.initSharedState(this)

    if (this.isHeadless) {
      this.creatures = []; this.creaturePool = [];
      this.plants = []; this.plantPool = [];
      this.resources = []; this.resourcePool = [];
      this.animals = []; this.animalPool = [];
      this.buildings = []; this.mines = [];
      this.nations = []; this.villages = [];
    } else {
      this.villages = []
    }

    this.lastTime = 0
    this.isRunning = false
    this.chunkManager = new ChunkManager(this.width, this.height, 320)
    this.quadTree = this.chunkManager
    this.maxFertility = 50000
    this.currentFertility = 50000

    if (!this.isHeadless) {
      this.bgCanvas = document.createElement('canvas')
      this.bgCanvas.width = this.width; this.bgCanvas.height = this.height
      this.bgCtx = this.bgCanvas.getContext('2d')
      
      this.bgBufferCanvas = document.createElement('canvas')
      this.bgBufferCanvas.width = this.width; this.bgBufferCanvas.height = this.height
      this.bgBufferCtx = this.bgBufferCanvas.getContext('2d')

      this.bgStaticCanvas = document.createElement('canvas')
      this.bgStaticCanvas.width = this.width; this.bgStaticCanvas.height = this.height
      this.bgStaticCtx = this.bgStaticCanvas.getContext('2d')
    }
    this.needsBackgroundUpdate = true
    this.needsStaticTerrainUpdate = true
    this.terrainSystem = new TerrainSystem(this.width, this.height, 16)
    this.brain = WorldSet
    this.brain.init(this)

    if (this.isHeadless) {
      this.terrainSystem.generateMap(new Uint8Array(this.sharedBuffers.terrain))
      this.brain.spawner.initNature(this)
    }
  }

  getEntityById(id, type) {
    if (!id || !type) return null
    const t = type.toLowerCase()
    if (t === 'creature') return this.creatures.find(e => e.id === id)
    if (t === 'building') return this.buildings.find(e => e.id === id)
    if (t === 'animal') return this.animals.find(e => e.id === id)
    const res = this.resources.find(e => e.id === id)
    return res || this.plants.find(e => e.id === id)
  }

  initSharedState(buffers) {
    this.sharedBuffers = buffers
    this.terrain = new Uint8Array(buffers.terrain)
    this.territory = new Uint8Array(buffers.territory)
    this.bufferSyncSystem.initSharedState(this, buffers)
  }

  broadcastEvent(text, color) { this.brain.spawner.broadcastEvent(this, text, color) }
  spawnParticle(x, y, config) { this.brain.spawner.spawnParticle(this, x, y, config) }
  showSpeechBubble(id, type, text) { this.brain.spawner.showSpeechBubble(this, id, type, text) }
  addFertility(amount) { return this.onProxyAction ? this.onProxyAction({ type: 'ADD_FERTILITY', payload: { amount } }) : this.brain.spawner.addFertility(this, amount) }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.animationId = requestAnimationFrame((t) => this.loop(t))
  }

  stop() {
    this.isRunning = false
    if (this.animationId) cancelAnimationFrame(this.animationId)
  }

  startLogic(onSync) {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    const logicLoop = () => {
      if (!this.isRunning) return
      try {
        const now = performance.now()
        const dt = Math.min(now - this.lastTime, 100)
        this.lastTime = now
        this.update(dt)
        if (onSync) onSync()
      } finally { setTimeout(logicLoop, 16) }
    }
    logicLoop()
  }

  syncToSharedBuffer() { this.bufferSyncSystem.syncToSharedBuffer(this) }

  spawnCreature(x, y) { return this.onProxyAction ? this.onProxyAction({ type: 'SPAWN_CREATURE', payload: { x, y } }) : this.brain.spawner.spawnCreature(this, x, y) }
  spawnAnimal(x, y, type) { return this.onProxyAction ? this.onProxyAction({ type: 'SPAWN_ANIMAL', payload: { x, y, type } }) : this.brain.spawner.spawnAnimal(this, x, y, type) }
  spawnBuilding(x, y, type, village) { return this.onProxyAction ? this.onProxyAction({ type: 'SPAWN_BUILDING', payload: { x, y, type, villageId: village?.id } }) : this.brain.spawner.spawnBuilding(this, x, y, type, village) }
  spawnPlant(x, y, type) { return this.onProxyAction ? this.onProxyAction({ type: 'SPAWN_PLANT', payload: { x, y, type } }) : this.brain.spawner.spawnPlant(this, x, y, type) }
  removePlant(plant) { this.brain.spawner.removePlant(this, plant) }
  spawnResource(x, y, type) { return this.onProxyAction ? this.onProxyAction({ type: 'SPAWN_RESOURCE', payload: { x, y, type } }) : this.brain.spawner.spawnResource(this, x, y, type) }
  removeResource(resource) { this.brain.spawner.removeResource(this, resource) }
  setWeather(type) { return this.onProxyAction ? this.onProxyAction({ type: 'SET_WEATHER', payload: { type } }) : this.brain.spawner.setWeather(this, type) }
  spawnTornado(x, y) { return this.onProxyAction ? this.onProxyAction({ type: 'SPAWN_TORNADO', payload: { x, y } }) : this.brain.spawner.spawnTornado(this, x, y) }
  triggerEarthquake() { return this.onProxyAction ? this.onProxyAction({ type: 'TRIGGER_EARTHQUAKE' }) : this.brain.spawner.triggerEarthquake(this) }
  loadCreatures(data) { this.brain.spawner.loadCreatures(this, data) }
  getEntityAt(x, y) { return this.brain.getEntityAt(this, x, y) }

  loop(timestamp) {
    if (!this.isRunning) return
    const dt = Math.min(timestamp - this.lastTime, 100)
    this.lastTime = timestamp
    if (!this.isHeadless) this.render(timestamp)
    this.animationId = requestAnimationFrame((t) => this.loop(t))
  }

  update(deltaTime) { this.brain.update(this, deltaTime) }
  render(timestamp) { this.renderSystem.render(this, timestamp) }
  getDataFromBuffer(type, id) { return this.bufferSyncSystem.getDataFromBuffer(this, type, id) }
}
