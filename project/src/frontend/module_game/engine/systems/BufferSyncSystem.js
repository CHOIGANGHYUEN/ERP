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
  initSharedState(world, buffers) {
    world.sharedBuffers = buffers
    world.views = {
      globals: new Float32Array(buffers.globals),
      creatures: new Float32Array(buffers.creatures),
      animals: new Float32Array(buffers.animals),
      plants: new Float32Array(buffers.plants),
      buildings: new Float32Array(buffers.buildings),
      villages: new Float32Array(buffers.villages),
      tornadoes: new Float32Array(buffers.tornadoes),
      mines: new Float32Array(buffers.mines),
      resources: new Float32Array(buffers.resources),
    }
  }

  syncToSharedBuffer(world) {
    if (!world.isHeadless || !world.views) return
    const {
      globals,
      creatures,
      animals,
      plants,
      buildings,
      villages,
      tornadoes,
      mines,
      resources,
    } = world.views

    globals[PROPS.GLOBALS.CREATURE_COUNT] = world.creatures.length
    globals[PROPS.GLOBALS.ANIMAL_COUNT] = world.animals.length
    globals[PROPS.GLOBALS.PLANT_COUNT] = world.plants.length
    globals[PROPS.GLOBALS.RESOURCE_COUNT] = world.resources.length
    globals[PROPS.GLOBALS.BUILDING_COUNT] = world.buildings.length
    globals[PROPS.GLOBALS.VILLAGE_COUNT] = world.villages.length
    globals[PROPS.GLOBALS.TORNADO_COUNT] = world.disasterSystem.tornadoes.length
    globals[PROPS.GLOBALS.MINE_COUNT] = world.mines.length
    globals[PROPS.GLOBALS.FERTILITY] = world.currentFertility
    globals[PROPS.GLOBALS.TIME_OF_DAY] = world.timeSystem.timeOfDay
    globals[PROPS.GLOBALS.SEASON] = SEASON_MAP[world.timeSystem.season]
    globals[PROPS.GLOBALS.DAYS] = world.timeSystem.days
    globals[PROPS.GLOBALS.EARTHQUAKE_TIMER] = world.disasterSystem.earthquakeTimer
    globals[PROPS.GLOBALS.WEATHER_TYPE] = WEATHER_MAP[world.weather.weatherType]
    globals[PROPS.GLOBALS.WIND_SPEED] = world.weather.windSpeed

    world.creatures.forEach((c, i) => {
      const offset = i * STRIDE.CREATURE
      const color = hexToRgb(c.color)
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
    })

    world.animals.forEach((a, i) => {
      const offset = i * STRIDE.ANIMAL
      const color = hexToRgb(a.color)
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
      const color = hexToRgb(p.color)
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
      const color = hexToRgb(b.color)
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
      const color = v.nation ? hexToRgb(v.nation.color) : { r: 0.8, g: 0.8, b: 0.8 }
      villages[offset + PROPS.VILLAGE.IS_ACTIVE] = v.isDead ? 0 : 1
      villages[offset + PROPS.VILLAGE.X] = v.x
      villages[offset + PROPS.VILLAGE.Y] = v.y
      villages[offset + PROPS.VILLAGE.RADIUS] = v.radius
      villages[offset + PROPS.VILLAGE.R] = color.r
      villages[offset + PROPS.VILLAGE.G] = color.g
      villages[offset + PROPS.VILLAGE.B] = color.b
      villages[offset + PROPS.VILLAGE.POPULATION] = v.creatures.length
      villages[offset + PROPS.VILLAGE.BUILDING_COUNT] = v.buildings.length
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
      const color = hexToRgb(m.color)
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
      const color = hexToRgb(r.color)
      resources[offset + PROPS.RESOURCE.IS_ACTIVE] = r.isDead ? 0 : 1
      resources[offset + PROPS.RESOURCE.X] = r.x
      resources[offset + PROPS.RESOURCE.Y] = r.y
      resources[offset + PROPS.RESOURCE.SIZE] = r.size || 5
      resources[offset + PROPS.RESOURCE.R] = color.r
      resources[offset + PROPS.RESOURCE.G] = color.g
      resources[offset + PROPS.RESOURCE.B] = color.b
      resources[offset + PROPS.RESOURCE.TYPE] = RESOURCE_TYPE_MAP[r.type] || 0
    })
  }

  getDataFromBuffer(world, type, id) {
    if (!world.views || id < 0) return null
    const view = world.views[`${type}s`]
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
