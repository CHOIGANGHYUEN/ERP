import { TOKENS } from '../../di/tokens/index.js'
import { ChunkManager } from '../systems/ChunkManager.js'
import { createSharedBuffers, PROPS, SEASON_MAP, STRIDE, WEATHER_MAP } from './SharedState.js'

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
    }
    this.bgUpdateTimer = 0
    this.needsBackgroundUpdate = true
    this.onProxyAction = null // Main 스레드에서 Worker로 통신하기 위한 프록시 콜백
    this.onEvent = null // Worker 스레드에서 Main으로 이벤트를 보내기 위한 브로드캐스터

    // 초기 생태계 구성
    if (this.isHeadless) {
      this.initNature()
    }
  }

  // [SAB] 버퍼 및 뷰 초기화
  initSharedState(buffers) {
    this.bufferSyncSystem.initSharedState(this, buffers)
  }

  // 실시간 이벤트 티커(Event Ticker) 브로드캐스트
  broadcastEvent(text, color = '#f1c40f') {
    if (this.isHeadless && this.onEvent) {
      this.onEvent({ type: 'SYSTEM_MESSAGE', payload: { text, color } })
    }
  }

  spawnParticle(x, y, config) {
    if (!this.isHeadless) {
      this.particleSystem.emit(x, y, config)
    }
  }

  showSpeechBubble(entityId, entityType, text, duration = 2000) {
    if (this.isHeadless) {
      if (this.onEvent)
        this.onEvent({ type: 'SPEECH_BUBBLE', payload: { entityId, entityType, text, duration } })
    } else {
      this.interactionSystem.addBubble(entityId, entityType, text, duration)
    }
  }

  addFertility(amount) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'ADD_FERTILITY', payload: { amount } })
    this.currentFertility = Math.min(this.maxFertility, this.currentFertility + amount)
  }

  initNature() {
    this.entitySpawnerSystem.initNature(this)
  }

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

  // 워커 전용 백그라운드 연산 루프
  startLogic(onSync) {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()

    const logicLoop = () => {
      if (!this.isRunning) return
      const now = performance.now()
      const dt = Math.min(now - this.lastTime, 100)
      this.lastTime = now

      this.update(dt)
      if (onSync) onSync() // [SAB] onSync는 이제 신호만 보냄

      setTimeout(logicLoop, 16) // 약 60FPS 유지
    }
    logicLoop()
  }

  // [SAB] Worker가 자신의 객체 상태를 공유 버퍼에 쓴다
  syncToSharedBuffer() {
    this.bufferSyncSystem.syncToSharedBuffer(this)
  }

  spawnCreature(x, y) {
    this.entitySpawnerSystem.spawnCreature(this, x, y)
  }

  spawnAnimal(x, y, type) {
    this.entitySpawnerSystem.spawnAnimal(this, x, y, type)
  }

  spawnBuilding(x, y, type, village) {
    this.entitySpawnerSystem.spawnBuilding(this, x, y, type, village)
  }

  spawnPlant(x, y, type) {
    this.entitySpawnerSystem.spawnPlant(this, x, y, type)
  }

  removePlant(plant) {
    this.entitySpawnerSystem.removePlant(this, plant)
  }

  spawnResource(x, y, type) {
    this.entitySpawnerSystem.spawnResource(this, x, y, type)
  }

  removeResource(resource) {
    this.entitySpawnerSystem.removeResource(this, resource)
  }

  setWeather(type) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'SET_WEATHER', payload: { type } })
    this.weather.weatherType = type
    this.weather.weatherTimer = 20000
  }

  spawnTornado(x, y) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'SPAWN_TORNADO', payload: { x, y } })
    this.disasterSystem.spawnTornado(x, y)
  }

  triggerEarthquake() {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'TRIGGER_EARTHQUAKE' })
    this.disasterSystem.triggerEarthquake()
  }

  loadCreatures(creaturesData) {
    this.entitySpawnerSystem.loadCreatures(this, creaturesData)
  }

  getEntityAt(screenX, screenY) {
    if (!this.views) return null // [SAB] 뷰가 초기화되기 전에는 아무것도 반환하지 않음

    const zoom = this.camera.zoom || 1
    const worldX = screenX / zoom + this.camera.x
    const worldY = screenY / zoom + this.camera.y

    // [SAB] ChunkManager는 메인 스레드의 update 루프에서 버퍼 기반으로 미리 빌드됨
    // 4.1 최적화: 클릭 반경(40x40 픽셀 영역) 내의 객체들만 O(1) 청크 탐색
    const range = { x: worldX - 20, y: worldY - 20, width: 40, height: 40 }
    const candidates = this.chunkManager.query(range)

    for (let i = candidates.length - 1; i >= 0; i--) {
      const entity = candidates[i]
      // entity는 이제 { _type: 'creature', id: 123, x, y, size } 형태의 Plain Object
      const dist = Math.sqrt(Math.pow(entity.x - worldX, 2) + Math.pow(entity.y - worldY, 2))
      if (dist < (entity.size || 16) + 10) {
        return entity
      }
    }

    // [SAB] 마을 클릭 감지
    const villageCount = this.views.globals[PROPS.GLOBALS.VILLAGE_COUNT]
    for (let i = 0; i < villageCount; i++) {
      const offset = i * STRIDE.VILLAGE
      if (this.views.villages[offset + PROPS.VILLAGE.IS_ACTIVE] === 1) {
        const vx = this.views.villages[offset + PROPS.VILLAGE.X]
        const vy = this.views.villages[offset + PROPS.VILLAGE.Y]
        const vRadius = this.views.villages[offset + PROPS.VILLAGE.RADIUS]
        if (Math.sqrt(Math.pow(vx - worldX, 2) + Math.pow(vy - worldY, 2)) < vRadius) {
          // Worker에 있는 실제 Village 객체 정보가 필요하므로, 이건 일단 보류
          // 간단하게 하려면 ID만 반환하고, Inspector에서 상세 정보를 별도 요청해야 함
          // 지금은 일단 클릭만 되도록
          return { _type: 'village', id: i, x: vx, y: vy, size: vRadius }
        }
      }
    }

    return null
  }

  loop(timestamp) {
    if (!this.isRunning) return
    const deltaTime = timestamp - this.lastTime
    this.lastTime = timestamp

    const dt = Math.min(deltaTime, 100)

    this.update(dt)
    this.render(timestamp)

    this.animationId = requestAnimationFrame((t) => this.loop(t))
  }

  update(deltaTime) {
    if (this.isHeadless) {
      // Worker: 실제 게임 로직 연산
      this.weather.update(deltaTime)
      this.timeSystem.update(deltaTime)
      this.disasterSystem.update(deltaTime, this)

      // Phase 3 외교/전쟁 시스템
      // this.diplomacySystem.update(deltaTime, this)

      this.chunkManager.clear()
      const allEntities = [
        ...this.creatures,
        ...this.animals,
        ...this.buildings,
        ...this.plants,
        ...this.resources,
        ...this.mines,
        ...this.disasterSystem.tornadoes,
      ]
      for (let i = 0; i < allEntities.length; i++) this.chunkManager.insert(allEntities[i])

      this.entitySystem.update(deltaTime, this)
      this.villageSystem.update(deltaTime, this)
      this.buildingSystem.update(deltaTime, this)

      this.bgUpdateTimer += deltaTime
      if (this.bgUpdateTimer >= 2000) {
        this.needsBackgroundUpdate = true
        this.bgUpdateTimer = 0
      }
    } else if (this.views) {
      // Main Thread: 렌더링 사전 작업 (QuadTree 재구성 등)
      const globals = this.views.globals
      this.currentFertility = globals[PROPS.GLOBALS.FERTILITY]
      this.timeSystem.timeOfDay = globals[PROPS.GLOBALS.TIME_OF_DAY]
      this.timeSystem.season = Object.keys(SEASON_MAP)[globals[PROPS.GLOBALS.SEASON]] || 'SPRING'
      this.weather.weatherType =
        Object.keys(WEATHER_MAP)[globals[PROPS.GLOBALS.WEATHER_TYPE]] || 'clear'
      this.weather.windSpeed = globals[PROPS.GLOBALS.WIND_SPEED]
      this.disasterSystem.earthquakeTimer = globals[PROPS.GLOBALS.EARTHQUAKE_TIMER]

      this.chunkManager.clear()

      const entityCounts = {
        creature: globals[PROPS.GLOBALS.CREATURE_COUNT],
        animal: globals[PROPS.GLOBALS.ANIMAL_COUNT],
        plant: globals[PROPS.GLOBALS.PLANT_COUNT],
        building: globals[PROPS.GLOBALS.BUILDING_COUNT],
        tornado: globals[PROPS.GLOBALS.TORNADO_COUNT],
        mine: globals[PROPS.GLOBALS.MINE_COUNT],
        resource: globals[PROPS.GLOBALS.RESOURCE_COUNT],
      }

      for (const type in entityCounts) {
        const count = entityCounts[type]
        const view = this.views[`${type}s`]
        const props = PROPS[type.toUpperCase()]
        const stride = STRIDE[type.toUpperCase()]

        // [SAB] 해당 타입에 대한 PROPS 정의가 없으면 QuadTree에 추가하지 않음 (오류 방지)
        if (!props || !stride) continue

        const propX = props.X
        const propY = props.Y
        const propSize = props.SIZE
        for (let i = 0; i < count; i++) {
          const offset = i * stride
          if (view[offset] === 1) {
            // IS_ACTIVE
            this.chunkManager.insert({
              _type: type,
              id: i,
              x: view[offset + propX],
              y: view[offset + propY],
              size: view[offset + propSize],
            })
          }
        }
      }

      // 오프스크린 캔버스 업데이트 로직
      this.bgUpdateTimer += deltaTime
      if (this.bgUpdateTimer >= 2000) {
        this.needsBackgroundUpdate = true
        this.bgUpdateTimer = 0
      }

      // 파티클은 렌더링 영역(메인 스레드)에서만 처리합니다.
      this.particleSystem.update(deltaTime)
      this.interactionSystem.update(deltaTime)
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
