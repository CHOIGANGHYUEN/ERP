// Constants for entity types, strides, and property offsets.
// This centralizes the memory layout for SharedArrayBuffer.

export const MAX_CREATURES = 2000
export const MAX_ANIMALS = 1000
export const MAX_PLANTS = 2000
export const MAX_RESOURCES = 3000
export const MAX_BUILDINGS = 500
export const MAX_VILLAGES = 50
export const MAX_MINES = 100
export const MAX_TORNADOES = 10

export const STRIDE = {
  GLOBALS: 16,
  CREATURE: 24,
  ANIMAL: 12,
  PLANT: 12,
  RESOURCE: 8,
  BUILDING: 12,
  VILLAGE: 12,
  MINE: 8,
  TORNADO: 6,
}

export const PROPS = {
  GLOBALS: {
    CREATURE_COUNT: 0,
    ANIMAL_COUNT: 1,
    PLANT_COUNT: 2,
    RESOURCE_COUNT: 3,
    BUILDING_COUNT: 4,
    VILLAGE_COUNT: 5,
    MINE_COUNT: 6,
    TORNADO_COUNT: 7,
    FERTILITY: 8,
    TIME_OF_DAY: 9,
    SEASON: 10,
    DAYS: 11,
    EARTHQUAKE_TIMER: 12,
    WEATHER_TYPE: 13,
    WIND_SPEED: 14,
    RENDER_BUFFER_INDEX: 15, // 0 or 1
  },
  CREATURE: {
    IS_ACTIVE: 0, // 1 for active, 0 for inactive
    X: 1,
    Y: 2,
    SIZE: 3,
    R: 4,
    G: 5,
    B: 6,
    AGE: 7,
    PROFESSION: 8,
    STATE: 9,
    CURRENT_FRAME: 10,
    ATTACK_POWER: 11,
    ENERGY: 12,
    NEEDS_HUNGER: 13,
    NEEDS_FATIGUE: 14,
    IS_ADULT: 15,
    VILLAGE_ID: 16,
    IS_IMMORTAL: 17,
    LEVEL: 18,
    EXP: 19,
    FAMILY_ID: 20,
    ROTATION: 21,
  },
  ANIMAL: {
    IS_ACTIVE: 0,
    X: 1,
    Y: 2,
    SIZE: 3,
    R: 4,
    G: 5,
    B: 6,
    TYPE: 7, // 0: HERBIVORE, 1: CARNIVORE
    STATE: 8,
    CURRENT_FRAME: 9,
    ENERGY: 10,
    SPECIES: 11, // 세부 종 구분 추가
  },
  RESOURCE: {
    IS_ACTIVE: 0,
    X: 1,
    Y: 2,
    SIZE: 3,
    R: 4,
    G: 5,
    B: 6,
    TYPE: 7,
  },
  MINE: {
    IS_ACTIVE: 0,
    X: 1,
    Y: 2,
    SIZE: 3,
    R: 4,
    G: 5,
    B: 6,
    TYPE: 7,
  },
  PLANT: {
    IS_ACTIVE: 0,
    X: 1,
    Y: 2,
    SIZE: 3,
    R: 4,
    G: 5,
    B: 6,
    TYPE: 7, // 0: grass, 1: tree, 2: crop
    AGE: 8,
    STATE: 9,
  },
  BUILDING: {
    IS_ACTIVE: 0,
    X: 1,
    Y: 2,
    SIZE: 3,
    R: 4,
    G: 5,
    B: 6,
    TYPE: 7,
    TIER: 8,
    IS_CONSTRUCTED: 9,
    CAPACITY: 10,
    OCCUPANTS: 11,
  },
  VILLAGE: {
    IS_ACTIVE: 0,
    X: 1,
    Y: 2,
    RADIUS: 3,
    R: 4,
    G: 5,
    B: 6,
    POPULATION: 7,
    BUILDING_COUNT: 8,
    LEADER_ID: 9,
    // Name and inventory are not shared for performance, only read on Inspector click
  },
}

// Maps for string-to-number conversion
export const PROFESSION_MAP = {
  NONE: 0,
  GATHERER: 1,
  LUMBERJACK: 2,
  FARMER: 3,
  BUILDER: 4,
  SCHOLAR: 5,
  WARRIOR: 6,
  MINER: 7,
  LEADER: 8,
  MERCHANT: 9,
}
export const STATE_MAP = {
  WANDERING: 0,
  GATHERING: 1,
  HARVESTING: 2,
  BUILDING: 3,
  STUDYING: 4,
  RETURNING: 5,
  ATTACKING: 6,
  MINING: 7,
  TRAINING: 8,
  RESTING: 9,
  EATING: 10,
  HUNTING: 11,
  GROWING: 12,
  TRADING: 13,
  DEPOSITING: 14,  // 창고에 자원 납부 중
  SUFFERING: 15,  // 극심한 허기/고통 (죽기 직전)
  MATING: 16,
  FLEEING: 17,
  IDLE: 18,
  MOVING: 19,
}
export const WEATHER_MAP = { clear: 0, rain: 1, fog: 2, snow: 3 }
export const SEASON_MAP = { SPRING: 0, SUMMER: 1, AUTUMN: 2, WINTER: 3 }
export const PLANT_TYPE_MAP = { grass: 0, tree: 1, crop: 2 }

export const TERRAIN_MAP = {
  GRASS: 0,
  LOW_MOUNTAIN: 1,
  HIGH_MOUNTAIN: 2,
  SHALLOW_SEA: 3,
  DEEP_SEA: 4,
  ABYSS: 5
}

// 10종 이상의 신규 동물 및 자원 타입 매핑
export const ANIMAL_SPECIES_MAP = {
  RABBIT: 0,
  DEER: 1,
  SHEEP: 2,
  COW: 3,
  BOAR: 4,
  ELEPHANT: 5,
  MAMMOTH: 6, // 초식/중립
  WOLF: 7,
  BEAR: 8,
  FOX: 9,
  TIGER: 10,
  LION: 11, // 육식
}
export const MINE_TYPE_MAP = {
  stone: 0,
  coal: 1,
  copper: 2,
  iron: 3,
  silver: 4,
  gold: 5,
  diamond: 6,
  ruby: 7,
  emerald: 8,
  sapphire: 9,
  uranium: 10,
}
export const RESOURCE_TYPE_MAP = {
  food: 0,
  wood: 1,
  stone: 2,
  coal: 3,
  copper: 4,
  iron: 5,
  silver: 6,
  gold: 7,
  diamond: 8,
  ruby: 9,
  emerald: 10,
  sapphire: 11,
  uranium: 12,
  biomass: 13,
  knowledge: 14,
  milk: 15,
  meat: 16,
}

// Reverse maps for UI
export const PROFESSION_REVERSE_MAP = Object.fromEntries(
  Object.entries(PROFESSION_MAP).map((a) => a.reverse()),
)
export const STATE_REVERSE_MAP = Object.fromEntries(
  Object.entries(STATE_MAP).map((a) => a.reverse()),
)
export const SEASON_REVERSE_MAP = Object.fromEntries(
  Object.entries(SEASON_MAP).map((a) => a.reverse()),
)

export function createSharedBuffers() {
  const isSharedSupported = typeof SharedArrayBuffer !== 'undefined'
  const BufferType = isSharedSupported ? SharedArrayBuffer : ArrayBuffer

  return {
    globals: new BufferType(STRIDE.GLOBALS * 4),
    // Double sets of entity buffers to prevent flickering
    sets: [
      {
        creatures: new BufferType(MAX_CREATURES * STRIDE.CREATURE * 4),
        animals: new BufferType(MAX_ANIMALS * STRIDE.ANIMAL * 4),
        plants: new BufferType(MAX_PLANTS * STRIDE.PLANT * 4),
        resources: new BufferType(MAX_RESOURCES * STRIDE.RESOURCE * 4),
        buildings: new BufferType(MAX_BUILDINGS * STRIDE.BUILDING * 4),
        villages: new BufferType(MAX_VILLAGES * STRIDE.VILLAGE * 4),
        mines: new BufferType(MAX_MINES * STRIDE.MINE * 4),
        tornadoes: new BufferType(MAX_TORNADOES * STRIDE.TORNADO * 4),
      },
      {
        creatures: new BufferType(MAX_CREATURES * STRIDE.CREATURE * 4),
        animals: new BufferType(MAX_ANIMALS * STRIDE.ANIMAL * 4),
        plants: new BufferType(MAX_PLANTS * STRIDE.PLANT * 4),
        resources: new BufferType(MAX_RESOURCES * STRIDE.RESOURCE * 4),
        buildings: new BufferType(MAX_BUILDINGS * STRIDE.BUILDING * 4),
        villages: new BufferType(MAX_VILLAGES * STRIDE.VILLAGE * 4),
        mines: new BufferType(MAX_MINES * STRIDE.MINE * 4),
        tornadoes: new BufferType(MAX_TORNADOES * STRIDE.TORNADO * 4),
      }
    ],
    paths: new BufferType(200 * 200 * 4),
    terrain: new BufferType(200 * 200),
    territory: new BufferType(200 * 200),
  }
}

export function hexToRgb(hex) {
  if (!hex) return { r: 1, g: 1, b: 1 }
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    }
    : { r: 1, g: 1, b: 1 }
}
