/**
 * 🏘️ Village Specialization Types
 */
export const VillageTypes = {
    GENERAL: 'general',
    AGRICULTURAL: 'agricultural',
    LUMBERING: 'lumbering',
    MINING: 'mining'
};

/**
 * 🎁 Specialization Bonuses
 */
export const VillageBonuses = {
    [VillageTypes.AGRICULTURAL]: {
        foodGatherRate: 1.5,
        woodGatherRate: 1.0,
        stoneGatherRate: 1.0,
        maxFoodBonus: 500
    },
    [VillageTypes.LUMBERING]: {
        foodGatherRate: 1.0,
        woodGatherRate: 1.5,
        stoneGatherRate: 1.0,
        maxWoodBonus: 500
    },
    [VillageTypes.MINING]: {
        foodGatherRate: 1.0,
        woodGatherRate: 1.0,
        stoneGatherRate: 1.5,
        maxStoneBonus: 500
    },
    [VillageTypes.GENERAL]: {
        foodGatherRate: 1.1,
        woodGatherRate: 1.1,
        stoneGatherRate: 1.1,
        maxAllBonus: 100
    }
};
