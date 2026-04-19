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

    // 맵 확장: 논리적 맵 크기
    this.width = 3200
    this.height = 3200

    // [Bugfix] 의존성 주입(DI)은 다른 시스템/버퍼 초기화 로직보다 항상 먼저 선언되어야 합니다.
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

    // 카메라 시스템
    if (!this.isHeadless && canvas) {
      this.ctx = canvas.getContext('2d')
      this.ctx.imageSmoothingEnabled = false // 픽셀 아트 느낌 유지
      this.camera = this.di.resolve(
        TOKENS.CameraSystem,
        canvas.width,
        canvas.height,
        this.width,
        this.height,
      )
    } else {
      this.camera = { x: 0, y: 0, zoom: 1, width: 800, height: 400 } // Worker용 더미 카메라
    }

    // [SAB] Shared Array Buffer
    if (sharedBuffers) {
      this.initSharedState(sharedBuffers)
    } else if (isHeadless) {
      this.sharedBuffers = createSharedBuffers()
      this.initSharedState(this.sharedBuffers)
    }
    
    // PathSystem 버퍼 연결
    this.pathSystem.initSharedState(this)

    // These object arrays only exist on the worker now
    if (this.isHeadless) {
      this.creatures = []
      this.creaturePool = []
      this.plants = []
      this.resources = []
      this.resourcePool = []
      this.animals = []
      this.animalPool = []
      this.buildings = []
      this.mines = []
      this.nations = []
      this.villages = []
    } else {
      // Main thread only needs mock arrays for things like inspector
      this.villages = []
    }

    // TODO: Phase 3 국가 간 외교 시스템 구현 후 활성화
    // this.diplomacySystem = this.di.resolve(TOKENS.DiplomacySystem)

    // Worker는 Tornado 객체 배열을 직접 관리, Main은 버퍼를 통해 읽음
    if (!this.isHeadless) {
      this.disasterSystem.tornadoes = []
    }

    this.lastTime = 0
    this.animationId = null
    this.isRunning = false

    this.chunkManager = new ChunkManager(this.width, this.height, 320)
    this.quadTree = this.chunkManager // [Bugfix] 레거시 AI 모듈(Wandering 등) 하위 호환성 유지 (query 에러 방지)

    this.maxFertility = 50000
    this.currentFertility = 50000
    this.maxPlants = 500 // 최대 식물 개수 제한 확장

    this.selectedEntity = null // UI 상태창 연동용

    // 4.4 최적화: 오프스크린 캔버스 초기화 (정적 환경 사전 렌더링용)
    if (!this.isHeadless) {
      this.bgCanvas = document.createElement('canvas')
      this.bgCanvas.width = this.width
      this.bgCanvas.height = this.height
      this.bgCtx = this.bgCanvas.getContext('2d')
      this.bgCtx.imageSmoothingEnabled = false

      // 오프스크린 버퍼 (Double Buffering용)
      this.bgBufferCanvas = document.createElement('canvas')
      this.bgBufferCanvas.width = this.width
      this.bgBufferCanvas.height = this.height
      this.bgBufferCtx = this.bgBufferCanvas.getContext('2d')
      this.bgBufferCtx.imageSmoothingEnabled = false

      // 정적 지형 레이어 (수만 개의 타일을 미리 그려 보관)
      this.bgStaticCanvas = document.createElement('canvas')
      this.bgStaticCanvas.width = this.width
      this.bgStaticCanvas.height = this.height
      this.bgStaticCtx = this.bgStaticCanvas.getContext('2d')
      this.bgStaticCtx.imageSmoothingEnabled = false
    }
    this.bgUpdateTimer = 0
    this.needsBackgroundUpdate = true
    this.needsStaticTerrainUpdate = true // 초기 지형 렌더링 필요
    this.onProxyAction = null // Main 스레드에서 Worker로 통신하기 위한 프록시 콜백
    this.onEvent = null // Worker 스레드에서 Main으로 이벤트를 보내기 위한 브로드캐스터

    // 지형 시스템
    this.terrainSystem = new TerrainSystem(this.width, this.height, 16)

    // Set 기반 뇌 주입
    this.brain = WorldSet
    this.brain.init(this)

    // 초기 생태계 구성
    if (this.isHeadless) {
      this.terrainSystem.generateMap(new Uint8Array(this.sharedBuffers.terrain))
      this.brain.spawner.initNature(this)
    }
  }

  // [SAB] 버퍼 및 뷰 초기화
  initSharedState(buffers) {
    this.sharedBuffers = buffers
    this.terrain = new Uint8Array(buffers.terrain)
    this.bufferSyncSystem.initSharedState(this, buffers)
    this.needsStaticTerrainUpdate = true // 새 데이터 연동 시 정적 렌더링 트리거
  }

  // 실시간 이벤트 티커(Event Ticker) 브로드캐스트
  broadcastEvent(text, color = '#f1c40f') {
    this.brain.spawner.broadcastEvent(this, text, color)
  }

  spawnParticle(x, y, config) {
    this.brain.spawner.spawnParticle(this, x, y, config)
  }

  showSpeechBubble(entityId, entityType, text, duration = 2000) {
    this.brain.spawner.showSpeechBubble(this, entityId, entityType, text, duration)
  }

  addFertility(amount) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'ADD_FERTILITY', payload: { amount } })
    }
    return this.brain.spawner.addFertility(this, amount)
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.animationId = requestAnimationFrame((t) => this.loop(t))
  }

  stop() {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    Logger.info('World', '월드 루프가 성공적으로 중단되었습니다.')
  }

  // 프레임 리소스 및 대규모 객체 해제 (Memory Hardening)
  destroy() {
    this.stop()
    this.creatures = []
    this.animals = []
    this.plants = []
    this.resources = []
    if (this.chunkManager) this.chunkManager.clearAll()
    
    // Canvas GPU 리소스 해제 힌트
    if (this.canvas) { this.canvas.width = 1; this.canvas.height = 1 }
    if (this.bgCanvas) { this.bgCanvas.width = 1; this.bgCanvas.height = 1 }
    if (this.bgBufferCanvas) { this.bgBufferCanvas.width = 1; this.bgBufferCanvas.height = 1 }
    if (this.bgStaticCanvas) { this.bgStaticCanvas.width = 1; this.bgStaticCanvas.height = 1 }
    
    Logger.info('World', '월드 리소스가 정리되었습니다.')
  }

  // 워커 전용 백그라운드 연산 루프
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
        if (onSync) onSync() // [SAB] onSync는 이제 신호만 보냄
      } catch (error) {
        Logger.error('LogicLoop', `워커 로직 루프 에러: ${error.message}`, error)
      } finally {
        setTimeout(logicLoop, 16) // 약 60FPS 유지 (에러 발생해도 루프는 지속)
      }
    }
    logicLoop()
  }

  // [SAB] Worker가 자신의 객체 상태를 공유 버퍼에 쓴다
  syncToSharedBuffer() {
    this.bufferSyncSystem.syncToSharedBuffer(this)
  }

  spawnCreature(x, y) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'SPAWN_CREATURE', payload: { x, y } })
    }
    this.brain.spawner.spawnCreature(this, x, y)
  }

  spawnAnimal(x, y, type) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'SPAWN_ANIMAL', payload: { x, y, type } })
    }
    this.brain.spawner.spawnAnimal(this, x, y, type)
  }

  spawnBuilding(x, y, type, village) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'SPAWN_BUILDING', payload: { x, y, type, village } })
    }
    this.brain.spawner.spawnBuilding(this, x, y, type, village)
  }

  spawnPlant(x, y, type) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'SPAWN_PLANT', payload: { x, y, type } })
    }
    this.brain.spawner.spawnPlant(this, x, y, type)
  }

  removePlant(plant) {
    this.brain.spawner.removePlant(this, plant)
  }

  spawnResource(x, y, type) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'SPAWN_RESOURCE', payload: { x, y, type } })
    }
    this.brain.spawner.spawnResource(this, x, y, type)
  }

  removeResource(resource) {
    this.brain.spawner.removeResource(this, resource)
  }

  setWeather(type) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'SET_WEATHER', payload: { type } })
    }
    return this.brain.spawner.setWeather(this, type)
  }

  spawnTornado(x, y) {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'SPAWN_TORNADO', payload: { x, y } })
    }
    return this.brain.spawner.spawnTornado(this, x, y)
  }

  triggerEarthquake() {
    if (this.onProxyAction) {
      return this.onProxyAction({ type: 'TRIGGER_EARTHQUAKE' })
    }
    return this.brain.spawner.triggerEarthquake(this)
  }

  loadCreatures(creaturesData) {
    this.brain.spawner.loadCreatures(this, creaturesData)
  }

  getEntityAt(screenX, screenY) {
    return this.brain.getEntityAt(this, screenX, screenY)
  }

  loop(timestamp) {
    if (!this.isRunning) return
    try {
      const deltaTime = timestamp - this.lastTime
      this.lastTime = timestamp

      const dt = Math.min(deltaTime, 100)

      this.update(dt)
      this.render(timestamp)
    } catch (error) {
      Logger.error('MainLoop', `메인 렌더 루프 에러: ${error.message}`, error)
    } finally {
      this.animationId = requestAnimationFrame((t) => this.loop(t))
    }
  }

  update(deltaTime) {
    try {
      this.brain.update(this, deltaTime)
    } catch (error) {
      Logger.error('WorldLoop', `에러 발생으로 이번 프레임을 스킵합니다: ${error.message}`, error)
    }
  }

  render(timestamp) {
    this.renderSystem.render(this, timestamp)
  }

  // [SAB] 버퍼에서 데이터를 읽어 Inspector용 Plain Object 생성
  getDataFromBuffer(type, id) {
    return this.bufferSyncSystem.getDataFromBuffer(this, type, id)
  }
}
