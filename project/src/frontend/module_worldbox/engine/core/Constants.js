/**
 * 🏷️ WorldBox Engine Constants & Type Mappings
 */

export const ENTITY_TYPES = {
    UNKNOWN: 0,
    // Species
    HUMAN: 1,
    SHEEP: 2,
    COW: 3,
    WOLF: 4,
    HYENA: 5,
    WILD_DOG: 6,
    BEE: 7,
    TIGER: 8,
    LION: 9,
    BEAR: 10,
    FOX: 11,
    CROCODILE: 12,
    DEER: 13,
    RABBIT: 14,
    HORSE: 15,
    ELEPHANT: 16,
    GOAT: 17,

    // Resources & Nature
    TREE: 50,
    PLANT: 51,
    ROCK: 52,
    BERRY_BUSH: 53,
    WHEAT: 54,
    
    // Buildings
    BUILDING: 100,
    HOUSE: 101,
    BONFIRE: 102,
    STORAGE: 103,
    FARM: 104,
    
    // Items
    ITEM: 200,
    DROPPED_ITEM: 201
};

export const ENTITY_FLAGS = {
    NONE: 0,
    FLIP_X: 1 << 0,
    IS_SLEEPING: 1 << 1,
    IS_EATING: 1 << 2,
    IS_CULLED: 1 << 3,
    IS_BLUEPRINT: 1 << 4,
    HAS_TARGET: 1 << 5,
    IS_DEAD: 1 << 6
};

export const ANIMAL_MODES = {
    IDLE: 0,
    WANDER: 1,
    WALK: 2,
    RUN: 3,
    FLEE: 4,
    HUNT: 5,
    FORAGE: 6,
    EAT: 7,
    SLEEP: 8,
    DIE: 9,
    GATHER: 10,
    BUILD: 11,
    DEPOSIT: 12
};

export const ID_TO_MODE_NAME = Object.fromEntries(
    Object.entries(ANIMAL_MODES).map(([name, id]) => [id, name.toLowerCase()])
);

export const MODE_NAME_TO_ID = Object.fromEntries(
    Object.entries(ANIMAL_MODES).map(([name, id]) => [name.toLowerCase(), id])
);

// Reverse mapping for easy lookup
export const ID_TO_TYPE_NAME = Object.fromEntries(
    Object.entries(ENTITY_TYPES).map(([name, id]) => [id, name.toLowerCase()])
);

export const TYPE_NAME_TO_ID = Object.fromEntries(
    Object.entries(ENTITY_TYPES).map(([name, id]) => [name.toLowerCase(), id])
);

/**
 * 🛰️ Shared Array Buffer Layout
 * Bits 0-7: Core Entity Flags (Physics/Logic)
 * Bits 8-31: Visual & Animation State Flags
 */
export const VISUAL_FLAGS = {
    IS_BABY: 1 << 8,
    IS_FEMALE: 1 << 9,
    IS_CHOPPING: 1 << 10,
    CARRYING_WOOD: 1 << 11,
    CARRYING_FOOD: 1 << 12,
    IS_STARVING: 1 << 13,
    IS_KING: 1 << 14,
    IS_SLEEPING: 1 << 15 // This is redundant with ENTITY_FLAGS.IS_SLEEPING but kept for visual sync
};

export const SHARED_LAYOUT = {
    STRIDE: 8,
    X: 0,
    Y: 1,
    SIZE: 2,
    ALPHA: 3,
    TYPE_ID: 4,
    FLAGS: 5,
    MODE_ID: 6,
    ID: 7
};
