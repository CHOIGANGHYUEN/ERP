import { Creature } from '../objects/life/Creature.js'
import { Plant } from '../objects/life/Plant.js'
import { Resource } from '../objects/environment/Resource.js'
import { Animal } from '../objects/life/Animal.js'
import { Building } from '../objects/society/Building.js'
import { Nation } from '../objects/society/Nation.js'
import { Village } from '../objects/society/Village.js'
import { WeatherSystem } from '../systems/WeatherSystem.js'
import { Camera } from '../systems/Camera.js'
import { QuadTree, Rectangle } from '../systems/QuadTree.js'
import { Mine } from '../objects/environment/Mine.js'
import { Tornado } from '../objects/environment/Tornado.js'
import { DisasterSystem } from '../systems/DisasterSystem.js'
import { TimeSystem } from '../systems/TimeSystem.js'

export class World {
  constructor(canvas, isHeadless = false) {
    this.isHeadless = isHeadless
    this.canvas = canvas

    // 맵 확장: 논리적 맵 크기
    this.width = 3200
    this.height = 3200

    // 카메라 시스템
    if (!this.isHeadless && canvas) {
      this.ctx = canvas.getContext('2d')
      this.ctx.imageSmoothingEnabled = false // 픽셀 아트 느낌 유지
      this.camera = new Camera(canvas.width, canvas.height, this.width, this.height)
    } else {
      this.camera = { x: 0, y: 0, width: 800, height: 400 } // Worker용 더미 카메라
    }

    this.creatures = []
    this.creaturePool = [] // 4.2 최적화: 생명체 오브젝트 풀
    this.plants = []
    this.resources = []
    this.resourcePool = [] // 4.2 최적화: 자원 오브젝트 풀
    this.animals = []
    this.animalPool = [] // 4.2 최적화: 동물 오브젝트 풀
    this.buildings = []
    this.mines = []

    this.nations = []
    this.villages = []

    this.weather = new WeatherSystem(this.width, this.height)
    this.timeSystem = new TimeSystem()
    this.disasterSystem = new DisasterSystem()

    this.lastTime = 0
    this.animationId = null
    this.isRunning = false

    this.quadTree = new QuadTree(new Rectangle(0, 0, this.width, this.height), 10)

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
    }
    this.bgUpdateTimer = 0
    this.needsBackgroundUpdate = true
    this.onProxyAction = null // Main 스레드에서 Worker로 통신하기 위한 프록시 콜백

    // 초기 생태계 구성
    if (this.isHeadless) {
      this.initNature()
    }
  }

  addFertility(amount) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'ADD_FERTILITY', payload: { amount } })
    this.currentFertility = Math.min(this.maxFertility, this.currentFertility + amount)
  }

  initNature() {
    for (let i = 0; i < 100; i++) {
      this.spawnPlant(Math.random() * this.width, Math.random() * this.height, 'grass')
    }
    for (let i = 0; i < 30; i++) {
      this.spawnPlant(Math.random() * this.width, Math.random() * this.height, 'tree')
    }
    for (let i = 0; i < 10; i++) {
      this.spawnAnimal(Math.random() * this.width, Math.random() * this.height, 'HERBIVORE')
    }
    for (let i = 0; i < 3; i++) {
      this.spawnAnimal(Math.random() * this.width, Math.random() * this.height, 'CARNIVORE')
    }
    // 초기 광맥 스폰
    for (let i = 0; i < 15; i++) {
      const rand = Math.random()
      const mType = rand < 0.6 ? 'stone' : rand < 0.9 ? 'iron' : 'gold'
      const m = new Mine(Math.random() * this.width, Math.random() * this.height, mType)
      this.mines.push(m)
    }
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
      if (onSync) onSync(this.exportState())

      setTimeout(logicLoop, 16) // 약 60FPS 유지
    }
    logicLoop()
  }

  // 직렬화 (Worker -> Main 전송용)
  exportState() {
    return {
      fertility: this.currentFertility,
      timeOfDay: this.timeSystem.timeOfDay,
      season: this.timeSystem.season,
      days: this.timeSystem.days,
      earthquakeTimer: this.disasterSystem.earthquakeTimer,
      weather: {
        type: this.weather.weatherType,
        windSpeed: this.weather.windSpeed,
        particles: this.weather.particles,
      },
      creatures: this.creatures.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        isDead: c.isDead,
        size: c.size,
        color: c.color,
        age: c.age,
        isAdult: c.isAdult,
        profession: c.profession,
        speed: c.speed,
        state: c.state,
        currentFrame: c.currentFrame,
        inventory: c.inventory,
        villageId: c.village ? c.village.id : null,
        targetX: c.targetX,
        targetY: c.targetY,
        needs: { ...c.needs },
        emotions: { ...c.emotions },
      })),
      plants: this.plants.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        isDead: p.isDead,
        size: p.size,
        color: p.color,
        type: p.type,
        age: p.age,
        maxSize: p.maxSize,
        energy: p.energy,
        state: p.state,
        needs: { ...p.needs },
        emotions: { ...p.emotions },
      })),
      resources: this.resources.map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        isDead: r.isDead,
        size: r.size,
        color: r.color,
        type: r.type,
      })),
      animals: this.animals.map((a) => ({
        id: a.id,
        x: a.x,
        y: a.y,
        isDead: a.isDead,
        size: a.size,
        color: a.color,
        type: a.type,
        speed: a.speed,
        state: a.state,
        energy: a.energy,
        currentFrame: a.currentFrame,
        needs: { ...a.needs },
        emotions: { ...a.emotions },
      })),
      buildings: this.buildings.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        isDead: b.isDead,
        size: b.size,
        color: b.color,
        type: b.type,
        tier: b.tier,
        isConstructed: b.isConstructed,
        progress: b.progress,
        maxProgress: b.maxProgress,
      })),
      mines: this.mines.map((m) => ({
        id: m.id,
        x: m.x,
        y: m.y,
        isDead: m.isDead,
        size: m.size,
        color: m.color,
        type: m.type,
        energy: m.energy,
      })),
      tornadoes: this.disasterSystem.tornadoes.map((t) => ({
        id: t.id,
        x: t.x,
        y: t.y,
        isDead: t.isDead,
        size: t.size,
        angle: t.angle,
      })),
      villages: this.villages.map((v) => ({
        id: v.id,
        x: v.x,
        y: v.y,
        name: v.name,
        radius: v.radius,
        nationColor: v.nation ? v.nation.color : null,
        population: v.creatures ? v.creatures.length : 0,
        buildingCount: v.buildings ? v.buildings.length : 0,
        inventory: v.inventory,
      })),
    }
  }

  // 병합 및 재구성 (Main 수신용)
  importState(state) {
    this.currentFertility = state.fertility
    this.timeSystem.timeOfDay = state.timeOfDay
    this.timeSystem.season = state.season
    this.timeSystem.days = state.days
    this.disasterSystem.earthquakeTimer = state.earthquakeTimer
    this.weather.weatherType = state.weather.type
    this.weather.windSpeed = state.weather.windSpeed
    this.weather.particles = state.weather.particles

    this.creatures = this._syncArray(state.creatures, this.creatures, Creature, this.creaturePool)
    this.plants = this._syncArray(state.plants, this.plants, Plant)
    this.resources = this._syncArray(state.resources, this.resources, Resource, this.resourcePool)
    this.animals = this._syncArray(state.animals, this.animals, Animal, this.animalPool)
    this.buildings = this._syncArray(state.buildings, this.buildings, Building)
    this.mines = this._syncArray(state.mines, this.mines, Mine)
    this.disasterSystem.tornadoes = this._syncArray(
      state.tornadoes,
      this.disasterSystem.tornadoes,
      Tornado,
    )

    // UI 연동을 위해 Creature의 마을 소속 참조 복구
    this.creatures.forEach((c) => {
      if (c.villageId) {
        c.village = this.villages.find((v) => v.id === c.villageId) || null
      } else {
        c.village = null
      }
    })

    this.villages = state.villages.map((sv) => {
      let v = this.villages.find((ov) => ov.id === sv.id)
      if (!v) v = new Village(sv.x, sv.y, sv.name)
      Object.assign(v, sv)
      if (sv.nationColor) v.nation = { color: sv.nationColor }
      return v
    })

    const now = performance.now()
    if (!this.lastBgUpdate || now - this.lastBgUpdate > 2000) {
      this.needsBackgroundUpdate = true
      this.lastBgUpdate = now
    }

    this.quadTree = new QuadTree(new Rectangle(0, 0, this.width, this.height), 10)
    const allEntities = [
      ...this.creatures,
      ...this.animals,
      ...this.buildings,
      ...this.plants,
      ...this.resources,
      ...this.mines,
      ...this.disasterSystem.tornadoes,
    ]
    for (let i = 0; i < allEntities.length; i++) this.quadTree.insert(allEntities[i])
  }

  _syncArray(source, target, Cls, poolArray) {
    const tMap = new Map(target.map((i) => [i.id, i]))
    const newTarget = source.map((s) => {
      let obj = tMap.get(s.id)
      if (!obj) {
        if (poolArray && poolArray.length > 0) {
          obj = poolArray.pop()
          obj.reset(s.x, s.y, s.type)
          obj.id = s.id
        } else {
          obj = new Cls(s.x, s.y, s.type)
          obj.id = s.id
        }
      }
      Object.assign(obj, s)
      tMap.delete(s.id)
      return obj
    })
    if (poolArray) for (let unused of tMap.values()) poolArray.push(unused)
    return newTarget
  }

  spawnCreature(x, y) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'SPAWN_CREATURE', payload: { x, y } })
    // 4.2 최적화: 풀에 남은 객체가 있으면 재사용, 없으면 새로 생성
    let creature
    if (this.creaturePool.length > 0) {
      creature = this.creaturePool.pop()
      creature.reset(x, y)
    } else {
      creature = new Creature(x, y)
    }
    this.creatures.push(creature)

    // 마을 자동 소속 시스템
    let joinedVillage = null
    for (const village of this.villages) {
      const dist = Math.sqrt(Math.pow(village.x - x, 2) + Math.pow(village.y - y, 2))
      if (dist < village.radius) {
        village.addCreature(creature)
        joinedVillage = village
        break
      }
    }

    // 주변에 마을이 없으면 새 마을 창설
    if (!joinedVillage) {
      const newVillage = new Village(x, y, `마을 ${this.villages.length + 1}`)
      this.villages.push(newVillage)
      newVillage.addCreature(creature)

      // 임시로 국가 자동 할당 로직
      if (this.nations.length === 0) {
        this.nations.push(new Nation('제국', '#9b59b6'))
      }
      this.nations[0].addVillage(newVillage)
    }
  }

  spawnAnimal(x, y, type) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'SPAWN_ANIMAL', payload: { x, y, type } })
    // 4.2 최적화: 동물 풀 확인 및 재사용
    let animal
    if (this.animalPool.length > 0) {
      animal = this.animalPool.pop()
      animal.reset(x, y, type)
    } else {
      animal = new Animal(x, y, type)
    }
    this.animals.push(animal)
  }

  spawnBuilding(x, y, type, village) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({
        type: 'SPAWN_BUILDING',
        payload: { x, y, type, villageId: village?.id },
      })
    // 1. 그리드/타일 기반 배치 체계 (32x32 픽셀 격자 스냅)
    const gridSize = 32
    const snapX = Math.floor(x / gridSize) * gridSize + gridSize / 2
    const snapY = Math.floor(y / gridSize) * gridSize + gridSize / 2

    // 충돌 방지: 해당 격자에 이미 건물이 존재하는지 확인
    const isOverlapping = this.buildings.some(
      (b) => Math.abs(b.x - snapX) < gridSize && Math.abs(b.y - snapY) < gridSize,
    )
    if (isOverlapping) return // 중복 배치 방지

    const b = new Building(snapX, snapY, type)
    this.buildings.push(b)
    if (village) {
      village.addBuilding(b)
    }
  }

  spawnPlant(x, y, type) {
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'SPAWN_PLANT', payload: { x, y, type } })
    if (this.plants.length >= this.maxPlants) return // 최대 식물 개수 제한

    if (x > 10 && x < this.width - 10 && y > 10 && y < this.height - 10) {
      this.plants.push(new Plant(x, y, type))
    }
  }

  removePlant(plant) {
    this.plants = this.plants.filter((p) => p !== plant)
  }

  spawnResource(x, y, type) {
    // 4.2 최적화: 자원 풀 확인 및 재사용
    let resource
    if (this.resourcePool.length > 0) {
      resource = this.resourcePool.pop()
      resource.reset(x, y, type)
    } else {
      resource = new Resource(x, y, type)
    }
    this.resources.push(resource)
  }

  removeResource(resource) {
    this.resources = this.resources.filter((r) => r !== resource)
    this.resourcePool.push(resource) // 수집되거나 소멸된 자원을 풀에 반납
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
    if (!this.isHeadless && this.onProxyAction)
      return this.onProxyAction({ type: 'LOAD_CREATURES', payload: { creaturesData } })
    this.creatures = creaturesData.map((data) => {
      const c = new Creature(data.x, data.y)
      if (data.color) c.color = data.color
      return c
    })
  }

  getEntityAt(screenX, screenY) {
    const worldX = screenX + this.camera.x
    const worldY = screenY + this.camera.y

    // 4.1 최적화: 클릭 반경(40x40 픽셀 영역) 내의 객체들만 QuadTree로 빠르게 탐색
    const range = new Rectangle(worldX - 20, worldY - 20, 40, 40)
    const candidates = this.quadTree.query(range)

    for (let i = candidates.length - 1; i >= 0; i--) {
      const entity = candidates[i]
      const dist = Math.sqrt(Math.pow(entity.x - worldX, 2) + Math.pow(entity.y - worldY, 2))
      if (dist < (entity.size || 16) + 10) {
        return entity
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
    this.weather.update(deltaTime)
    this.timeSystem.update(deltaTime)
    this.disasterSystem.update(deltaTime, this)

    // 매 프레임 QuadTree 초기화 및 전체 엔티티 삽입
    this.quadTree = new QuadTree(new Rectangle(0, 0, this.width, this.height), 10)
    const allEntities = [
      ...this.creatures,
      ...this.animals,
      ...this.buildings,
      ...this.plants,
      ...this.resources,
      ...this.mines,
      ...this.disasterSystem.tornadoes,
    ]
    for (let i = 0; i < allEntities.length; i++) {
      this.quadTree.insert(allEntities[i])
    }

    this.creatures.forEach((c) => c.update(deltaTime, this))
    this.plants.forEach((p) => p.update(deltaTime, this))
    this.resources.forEach((r) => r.update(deltaTime, this))
    this.animals.forEach((a) => a.update(deltaTime, this))
    this.villages.forEach((v) => v.update(deltaTime, this))
    this.mines.forEach((m) => m.update(deltaTime, this))

    // 4.4 최적화: 건물 상태 변화 감지 및 오프스크린 캔버스 갱신 트리거
    this.buildings.forEach((b) => {
      const wasConstructed = b.isConstructed
      const prevTier = b.tier
      b.update(deltaTime, this)
      // 건물이 막 완성되었거나 티어가 업그레이드 되면 배경에 덮어쓰기 위해 즉시 갱신
      if (wasConstructed !== b.isConstructed || prevTier !== b.tier) {
        this.needsBackgroundUpdate = true
      }
    })

    // 4.4 최적화: 마을 영토 확장 등 느린 변화를 반영하기 위해 2초마다 주기적 배경 갱신
    this.bgUpdateTimer += deltaTime
    if (this.bgUpdateTimer >= 2000) {
      this.needsBackgroundUpdate = true
      this.bgUpdateTimer = 0
    }
  }

  render(timestamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.save()
    this.ctx.translate(-this.camera.x, -this.camera.y)
    this.disasterSystem.applyCameraShake(this.ctx) // 지진 카메라 흔들림

    // 4.4 최적화: 오프스크린 캔버스 갱신이 필요할 때만 무거운 그리기 연산 수행
    if (this.needsBackgroundUpdate) {
      this.bgCtx.clearRect(0, 0, this.width, this.height)
      this.villages.forEach((v) => v.render(this.bgCtx)) // 마을 영토(바닥)

      const completedBuildings = this.buildings.filter((b) => b.isConstructed)
      completedBuildings.sort((a, b) => a.y - b.y) // Y축 깊이 정렬
      completedBuildings.forEach((b) => b.render(this.bgCtx)) // 완성된 건물 병합

      this.needsBackgroundUpdate = false
    }

    // 통째로 미리 그려진 3200x3200 배경 캔버스를 메인 캔버스에 한 번에 복사 (Draw Call 최소화)
    this.ctx.drawImage(this.bgCanvas, 0, 0)

    // 4.1 최적화: 전체 배열 대신, 현재 카메라 뷰포트 영역(Culling Box) 내의 객체만 QuadTree로 불러오기
    const viewRange = new Rectangle(
      this.camera.x - 50,
      this.camera.y - 50,
      this.camera.width + 100,
      this.camera.height + 100,
    )
    const drawables = this.quadTree.query(viewRange)

    // Y축 기준 정렬(깊이/Z-index 처리)
    drawables.sort((a, b) => a.y - b.y)

    drawables.forEach((obj) => {
      if (obj instanceof Plant) {
        obj.render(this.ctx, timestamp, this.weather.windSpeed)
      } else if (obj instanceof Creature) {
        obj.render(this.ctx, timestamp)
      } else if (obj instanceof Resource) {
        obj.render(this.ctx)
      } else if (obj instanceof Animal) {
        obj.render(this.ctx, timestamp)
      } else if (obj instanceof Building) {
        // 공사 중인 건물만 동적으로 렌더링 (완성된 건물은 이미 bgCanvas에 그려져 있음)
        if (!obj.isConstructed) obj.render(this.ctx)
      } else if (obj instanceof Mine) {
        obj.render(this.ctx)
      } else if (obj instanceof Tornado) {
        obj.render(this.ctx)
      }
    })

    if (this.selectedEntity && !this.selectedEntity.isDead) {
      this.ctx.strokeStyle = '#f1c40f'
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(
        this.selectedEntity.x,
        this.selectedEntity.y,
        (this.selectedEntity.size || 16) + 4,
        0,
        Math.PI * 2,
      )
      this.ctx.stroke()
    }

    this.ctx.restore()

    // 날씨 시스템 (고정 렌더링)
    this.weather.render(this.ctx)

    // 시간 및 계절 조명 오버레이 렌더링
    this.timeSystem.renderOverlay(this.ctx, this.canvas.width, this.canvas.height)
  }
}
