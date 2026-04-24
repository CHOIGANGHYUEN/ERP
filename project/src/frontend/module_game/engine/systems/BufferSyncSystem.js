import {
  ANIMAL_SPECIES_MAP,
  MINE_TYPE_MAP,
  RESOURCE_TYPE_MAP,
  hexToRgb,
  PLANT_TYPE_MAP,
  PROFESSION_MAP,
  PROPS,
  SEASON_MAP,
  STATE_MAP,
  STRIDE,
  WEATHER_MAP,
} from '../core/SharedState.js'
import { FamilySystem } from '../systems/FamilySystem.js'

const BUILDING_TYPE_MAP = {
  HOUSE: 0,
  SCHOOL: 1,
  FARM: 2,
  BARRACKS: 3,
  TEMPLE: 4,
  SMITHY: 5,
  RANCH: 6,
  WAREHOUSE: 7,
  MARKET: 8,
  TAVERN: 9,
}
const BUILDING_TYPE_REVERSE_MAP = Object.fromEntries(
  Object.entries(BUILDING_TYPE_MAP).map((a) => a.reverse()),
)

export class BufferSyncSystem {
  constructor() {
    // 런타임 문자열 연산 방지를 위해 프로퍼티 맵 사전 계산
    this.propMaps = {}
    this._precomputePropMaps()
  }

  _precomputePropMaps() {
    const toCamel = (s) => s.toLowerCase().replace(/_(\w)/g, (m) => m[1].toUpperCase())
    for (const type in PROPS) {
      if (type === 'GLOBALS') continue
      this.propMaps[type.toLowerCase()] = {}
      for (const key in PROPS[type]) {
        this.propMaps[type.toLowerCase()][toCamel(key)] = PROPS[type][key]
      }
    }
  }

  initSharedState(world, buffers) {
    world.sharedBuffers = buffers
    world.views = {
      globals: new Float32Array(buffers.globals),
      globalsInt32: new Int32Array(buffers.globals), // [SAB] Atomic 연산을 위한 Int32 뷰 추가
      sets: [
        {
          creatures: new Float32Array(buffers.sets[0].creatures),
          animals: new Float32Array(buffers.sets[0].animals),
          plants: new Float32Array(buffers.sets[0].plants),
          buildings: new Float32Array(buffers.sets[0].buildings),
          villages: new Float32Array(buffers.sets[0].villages),
          tornadoes: new Float32Array(buffers.sets[0].tornadoes),
          mines: new Float32Array(buffers.sets[0].mines),
          resources: new Float32Array(buffers.sets[0].resources),
        },
        {
          creatures: new Float32Array(buffers.sets[1].creatures),
          animals: new Float32Array(buffers.sets[1].animals),
          plants: new Float32Array(buffers.sets[1].plants),
          buildings: new Float32Array(buffers.sets[1].buildings),
          villages: new Float32Array(buffers.sets[1].villages),
          tornadoes: new Float32Array(buffers.sets[1].tornadoes),
          mines: new Float32Array(buffers.sets[1].mines),
          resources: new Float32Array(buffers.sets[1].resources),
        },
      ],
      paths: new Float32Array(buffers.paths),
      terrain: new Uint8Array(buffers.terrain),
      territory: new Uint8Array(buffers.territory),
    }
  }

  syncToSharedBuffer(world) {
    if (!world.isHeadless || !world.views) return
    const { globals, globalsInt32, sets } = world.views
    const renderIndex = Atomics.load(globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)
    const writeIndex = renderIndex === 0 ? 1 : 0
    const backBuffer = sets[writeIndex]

    try {
      const { creatures, animals, plants, buildings, villages, tornadoes, mines, resources } =
        backBuffer

      world.creatures.forEach((c, i) => {
        const offset = i * STRIDE.CREATURE
        const color = hexToRgb(c.color || '#ffffff')
        const village = world.villages.findIndex((v) => v === c.village)
        creatures[offset + PROPS.CREATURE.IS_ACTIVE] = c.isDead ? 0 : 1
        creatures[offset + PROPS.CREATURE.X] = c.x
        creatures[offset + PROPS.CREATURE.Y] = c.y
        creatures[offset + PROPS.CREATURE.SIZE] = c.size
        creatures[offset + PROPS.CREATURE.R] = color.r
        creatures[offset + PROPS.CREATURE.G] = color.g
        creatures[offset + PROPS.CREATURE.B] = color.b
        creatures[offset + PROPS.CREATURE.AGE] = c.age
        creatures[offset + PROPS.CREATURE.PROFESSION] = PROFESSION_MAP[c.profession] || 0
        creatures[offset + PROPS.CREATURE.STATE] = STATE_MAP[c.state] || 0
        creatures[offset + PROPS.CREATURE.CURRENT_FRAME] = c.currentFrame
        creatures[offset + PROPS.CREATURE.ATTACK_POWER] = c.attackPower
        creatures[offset + PROPS.CREATURE.ENERGY] = c.energy
        creatures[offset + PROPS.CREATURE.NEEDS_HUNGER] = c.needs.hunger
        creatures[offset + PROPS.CREATURE.NEEDS_FATIGUE] = c.needs.fatigue
        creatures[offset + PROPS.CREATURE.IS_ADULT] = c.isAdult ? 1 : 0
        creatures[offset + PROPS.CREATURE.VILLAGE_ID] = village
        creatures[offset + PROPS.CREATURE.IS_IMMORTAL] = c.isImmortal ? 1 : 0
        creatures[offset + PROPS.CREATURE.LEVEL] = c.level || 1
        creatures[offset + PROPS.CREATURE.EXP] = c.exp || 0
        creatures[offset + PROPS.CREATURE.FAMILY_ID] = c.familyId || 0
        creatures[offset + PROPS.CREATURE.ROTATION] = c.transform ? c.transform.rotation : 0
      })

      world.animals.forEach((a, i) => {
        const offset = i * STRIDE.ANIMAL
        const color = hexToRgb(a.color || '#ffffff')
        animals[offset + PROPS.ANIMAL.IS_ACTIVE] = a.isDead ? 0 : 1
        animals[offset + PROPS.ANIMAL.X] = a.x
        animals[offset + PROPS.ANIMAL.Y] = a.y
        animals[offset + PROPS.ANIMAL.SIZE] = a.size
        animals[offset + PROPS.ANIMAL.R] = color.r
        animals[offset + PROPS.ANIMAL.G] = color.g
        animals[offset + PROPS.ANIMAL.B] = color.b
        animals[offset + PROPS.ANIMAL.TYPE] = a.type === 'CARNIVORE' ? 1 : 0
        animals[offset + PROPS.ANIMAL.STATE] = STATE_MAP[a.state] || 0
        animals[offset + PROPS.ANIMAL.CURRENT_FRAME] = a.currentFrame
        animals[offset + PROPS.ANIMAL.ENERGY] = a.energy
        animals[offset + PROPS.ANIMAL.SPECIES] = ANIMAL_SPECIES_MAP[a.species] || 0
      })

      world.plants.forEach((p, i) => {
        const offset = i * STRIDE.PLANT
        const color = hexToRgb(p.color || '#ffffff')
        plants[offset + PROPS.PLANT.IS_ACTIVE] = p.isDead ? 0 : 1
        plants[offset + PROPS.PLANT.X] = p.x
        plants[offset + PROPS.PLANT.Y] = p.y
        plants[offset + PROPS.PLANT.SIZE] = p.size
        plants[offset + PROPS.PLANT.R] = color.r
        plants[offset + PROPS.PLANT.G] = color.g
        plants[offset + PROPS.PLANT.B] = color.b
        plants[offset + PROPS.PLANT.TYPE] = PLANT_TYPE_MAP[p.type] || 0
        plants[offset + PROPS.PLANT.AGE] = p.age
        plants[offset + PROPS.PLANT.STATE] = STATE_MAP[p.state] || 0
      })

      world.buildings.forEach((b, i) => {
        const offset = i * STRIDE.BUILDING
        const color = hexToRgb(b.color || '#ffffff')
        buildings[offset + PROPS.BUILDING.IS_ACTIVE] = b.isDead ? 0 : 1
        buildings[offset + PROPS.BUILDING.X] = b.x
        buildings[offset + PROPS.BUILDING.Y] = b.y
        buildings[offset + PROPS.BUILDING.SIZE] = b.size
        buildings[offset + PROPS.BUILDING.R] = color.r
        buildings[offset + PROPS.BUILDING.G] = color.g
        buildings[offset + PROPS.BUILDING.B] = color.b
        buildings[offset + PROPS.BUILDING.TYPE] = BUILDING_TYPE_MAP[b.type] || 0
        buildings[offset + PROPS.BUILDING.TIER] = b.tier
        buildings[offset + PROPS.BUILDING.IS_CONSTRUCTED] = b.isConstructed ? 1 : 0
        buildings[offset + PROPS.BUILDING.CAPACITY] = b.capacity || 0
        buildings[offset + PROPS.BUILDING.OCCUPANTS] = b.occupants?.length || 0
      })

      world.villages.forEach((v, i) => {
        const offset = i * STRIDE.VILLAGE
        const color = v.nation ? hexToRgb(v.nation.color || '#ffffff') : { r: 0.8, g: 0.8, b: 0.8 }
        villages[offset + PROPS.VILLAGE.IS_ACTIVE] = v.isDead ? 0 : 1
        villages[offset + PROPS.VILLAGE.X] = v.x
        villages[offset + PROPS.VILLAGE.Y] = v.y
        villages[offset + PROPS.VILLAGE.RADIUS] = v.radius
        villages[offset + PROPS.VILLAGE.R] = color.r
        villages[offset + PROPS.VILLAGE.G] = color.g
        villages[offset + PROPS.VILLAGE.B] = color.b
        villages[offset + PROPS.VILLAGE.POPULATION] = v.creatures?.length || 0
        villages[offset + PROPS.VILLAGE.BUILDING_COUNT] = v.buildings?.length || 0
      })

      world.disasterSystem.tornadoes.forEach((t, i) => {
        const offset = i * STRIDE.TORNADO
        tornadoes[offset] = t.isDead ? 0 : 1
        tornadoes[offset + 1] = t.x
        tornadoes[offset + 2] = t.y
        tornadoes[offset + 3] = t.size
        tornadoes[offset + 4] = t.angle
      })

      world.mines.forEach((m, i) => {
        const offset = i * STRIDE.MINE
        const color = hexToRgb(m.color || '#ffffff')
        mines[offset + PROPS.MINE.IS_ACTIVE] = m.isDead ? 0 : 1
        mines[offset + PROPS.MINE.X] = m.x
        mines[offset + PROPS.MINE.Y] = m.y
        mines[offset + PROPS.MINE.SIZE] = m.size || 20
        mines[offset + PROPS.MINE.R] = color.r
        mines[offset + PROPS.MINE.G] = color.g
        mines[offset + PROPS.MINE.B] = color.b
        mines[offset + PROPS.MINE.TYPE] = MINE_TYPE_MAP[m.type] || 0
      })

      world.resources.forEach((r, i) => {
        const offset = i * STRIDE.RESOURCE
        const color = hexToRgb(r.color || '#ffffff')
        resources[offset + PROPS.RESOURCE.IS_ACTIVE] = r.isDead ? 0 : 1
        resources[offset + PROPS.RESOURCE.X] = r.x
        resources[offset + PROPS.RESOURCE.Y] = r.y
        resources[offset + PROPS.RESOURCE.SIZE] = r.size || 5
        resources[offset + PROPS.RESOURCE.R] = color.r
        resources[offset + PROPS.RESOURCE.G] = color.g
        resources[offset + PROPS.RESOURCE.B] = color.b
        resources[offset + PROPS.RESOURCE.TYPE] = RESOURCE_TYPE_MAP[r.type] || 0
      })

      // [Atomic Store] 개체 수를 Int32 형식으로 안전하게 저장 (RenderSystem의 무한 루프 방지)
      Atomics.store(globalsInt32, PROPS.GLOBALS.CREATURE_COUNT, world.creatures.length)
      Atomics.store(globalsInt32, PROPS.GLOBALS.ANIMAL_COUNT, world.animals.length)
      Atomics.store(globalsInt32, PROPS.GLOBALS.PLANT_COUNT, world.plants.length)
      Atomics.store(globalsInt32, PROPS.GLOBALS.RESOURCE_COUNT, world.resources.length)
      Atomics.store(globalsInt32, PROPS.GLOBALS.BUILDING_COUNT, world.buildings.length)
      Atomics.store(globalsInt32, PROPS.GLOBALS.VILLAGE_COUNT, world.villages.length)
      Atomics.store(globalsInt32, PROPS.GLOBALS.TORNADO_COUNT, world.disasterSystem.tornadoes.length)
      Atomics.store(globalsInt32, PROPS.GLOBALS.MINE_COUNT, world.mines.length)

      // 기타 시뮬레이션 상태 동기화 (Float 값들은 그대로 유지 가능하나 가독성을 위해 명시)
      globals[PROPS.GLOBALS.FERTILITY] = world.currentFertility
      globals[PROPS.GLOBALS.TIME_OF_DAY] = world.timeSystem.timeOfDay
      globals[PROPS.GLOBALS.SEASON] = SEASON_MAP[world.timeSystem.season]
      globals[PROPS.GLOBALS.DAYS] = world.timeSystem.days
      globals[PROPS.GLOBALS.EARTHQUAKE_TIMER] = world.disasterSystem.earthquakeTimer
      globals[PROPS.GLOBALS.WEATHER_TYPE] = WEATHER_MAP[world.weather.weatherType]
      globals[PROPS.GLOBALS.WIND_SPEED] = world.weather.windSpeed
    } catch (error) {
      console.error('🚨 [BufferSyncSystem] 버퍼 동기화 중 오류 발생 (Freezing 방어):', error)
    } finally {
      // [Atomic Swap] 모든 작업이 끝난 후에만 가용한 버퍼 인덱스를 교체
      Atomics.store(globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX, writeIndex)
    }
  }

  /**
   * 고속 렌더 패스를 위한 무할당(Zero-Allocation) 동기화 메서드.
   * 새로운 객체를 생성하지 않고 전달받은 target의 속성을 직접 수정합니다.
   */
  hydrate(world, target, type, id, forcedIndex = null) {
    if (!world.views || id < 0) return false

    // [Atomic Load] Atomics.load를 사용하여 메모리 가시성 보장 및 데이터 레이스 방지
    // forcedIndex가 제공되면 해당 인덱스(고정된 프레임 데이터)를 사용합니다.
    const frontIndex =
      forcedIndex !== null
        ? forcedIndex
        : Atomics.load(world.views.globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)

    if (frontIndex !== 0 && frontIndex !== 1) return false // 인덱스 유효성 검사

    const set = world.views.sets[frontIndex]
    if (!set) return false

    const view = set[`${type}s`]
    if (!view) return false

    const stride = STRIDE[type.toUpperCase()]
    const offset = id * stride
    if (view[offset] === 0) {
      target.isDead = true
      return false
    }

    target.id = id
    target._type = type
    target.isDead = false

    const propMap = this.propMaps[type]
    for (const key in propMap) {
      target[key] = view[offset + propMap[key]]
    }

    // 종속성 속성 및 상수 매핑 최적화
    if (type === 'creature' || type === 'animal') {
      target.frameOffsets = [0, -2, -4, -2, 0, 2, 4, 2]
    }

    const nr = Math.round(target.r * 255)
    const ng = Math.round(target.g * 255)
    const nb = Math.round(target.b * 255)
    if (target._lastR !== nr || target._lastG !== ng || target._lastB !== nb) {
      target.color = `rgb(${nr},${ng},${nb})`
      target._lastR = nr
      target._lastG = ng
      target._lastB = nb
    }

    if (type === 'creature') {
      target.profession = Object.keys(PROFESSION_MAP)[target.profession]
      target.state = Object.keys(STATE_MAP)[target.state]
      target.isAdult = target.isAdult === 1
      target.isImmortal = target.isImmortal === 1
      target.needs = { hunger: target.needsHunger, fatigue: target.needsFatigue }
    } else if (type === 'animal') {
      target.state = Object.keys(STATE_MAP)[target.state]
      target.type = target.type === 1 ? 'CARNIVORE' : 'HERBIVORE'
      target.species = Object.keys(ANIMAL_SPECIES_MAP)[target.species] || target.type
    } else if (type === 'plant') {
      target.state = Object.keys(STATE_MAP)[target.state]
      target.type = Object.keys(PLANT_TYPE_MAP)[target.type]
    } else if (type === 'building') {
      target.isConstructed = target.isConstructed === 1
      target.type = BUILDING_TYPE_REVERSE_MAP[target.type]
    } else if (type === 'village') {
      target.isVillage = true
      target.name = `마을 ${id + 1}`
      target.nation = { color: target.color, name: '국가' }
    } else if (type === 'mine') {
      target.type = Object.keys(MINE_TYPE_MAP)[target.type]
    } else if (type === 'resource') {
      target.type = Object.keys(RESOURCE_TYPE_MAP)[target.type]
    }

    return true
  }

  getDataFromBuffer(world, type, id, forcedIndex = null) {
    if (!world.views || id < 0) return false

    // [Atomic Load] 데이터 원자성 보장
    const frontIndex =
      forcedIndex !== null
        ? forcedIndex
        : Atomics.load(world.views.globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)

    if (frontIndex !== 0 && frontIndex !== 1) return null

    const set = world.views.sets[frontIndex]
    if (!set) return null

    const view = set[`${type}s`]
    if (!view) return null
    const stride = STRIDE[type.toUpperCase()]
    const offset = id * stride

    if (view[offset] === 0) return { isDead: true } // IS_ACTIVE

    const toCamel = (s) => s.toLowerCase().replace(/_(\w)/g, (m) => m[1].toUpperCase())
    const data = { _type: type, id: id, isDead: false }
    const props = PROPS[type.toUpperCase()]

    for (const key in props) {
      const propKey = toCamel(key)
      data[propKey] = view[offset + props[key]]
    }

    if (type === 'creature' || type === 'animal') data.frameOffsets = [0, -2, -4, -2, 0, 2, 4, 2]

    if (type === 'creature') {
      data.profession = Object.keys(PROFESSION_MAP)[data.profession]
      data.state = Object.keys(STATE_MAP)[data.state]
      data.isAdult = data.isAdult === 1
      data.isImmortal = data.isImmortal === 1
      data.color = `rgb(${Math.round(data.r * 255)}, ${Math.round(data.g * 255)}, ${Math.round(data.b * 255)})`
      data.needs = { hunger: data.needsHunger, fatigue: data.needsFatigue }
      data.emotions = {}
      data.exp = Math.floor(data.exp)
      data.maxExp = Math.floor(100 * Math.pow(1.5, (data.level || 1) - 1))
      data.workEfficiency = (1.0 + ((data.level || 1) - 1) * 0.2).toFixed(1) + 'x'
      data.familyName = FamilySystem.getNameById(data.familyId || 0)
    } else if (type === 'animal') {
      data.color = `rgb(${Math.round(data.r * 255)}, ${Math.round(data.g * 255)}, ${Math.round(data.b * 255)})`
      data.state = Object.keys(STATE_MAP)[data.state]
      data.type = data.type === 1 ? 'CARNIVORE' : 'HERBIVORE'
      data.species = Object.keys(ANIMAL_SPECIES_MAP)[data.species] || data.type
    } else if (type === 'plant') {
      data.color = `rgb(${Math.round(data.r * 255)}, ${Math.round(data.g * 255)}, ${Math.round(data.b * 255)})`
      data.state = Object.keys(STATE_MAP)[data.state]
      data.type = Object.keys(PLANT_TYPE_MAP)[data.type]
    } else if (type === 'village') {
      data.color = `rgb(${Math.round(data.r * 255)}, ${Math.round(data.g * 255)}, ${Math.round(data.b * 255)})`
      data.isVillage = true
      data.name = `마을 ${id + 1}`
      data.nation = { color: data.color, name: '국가' }
      data.inventory = {}
      data.buildings = data.building_count
    } else if (type === 'building') {
      data.isConstructed = data.isConstructed === 1
      data.type = BUILDING_TYPE_REVERSE_MAP[data.type]
    } else if (type === 'mine') {
      data.color = `rgb(${Math.round(data.r * 255)}, ${Math.round(data.g * 255)}, ${Math.round(data.b * 255)})`
      data.type = Object.keys(MINE_TYPE_MAP)[data.type]
    } else if (type === 'resource') {
      data.color = `rgb(${Math.round(data.r * 255)}, ${Math.round(data.g * 255)}, ${Math.round(data.b * 255)})`
      data.type = Object.keys(RESOURCE_TYPE_MAP)[data.type]
    }
    return data
  }
}
