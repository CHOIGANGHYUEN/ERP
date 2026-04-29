import System from '../../core/System.js';
import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';

export default class MetabolismSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; // TerrainGen 인스턴스 주입
        this.excreteThreshold = 1.0;
    }

    update(dt, time) {
        const em = this.entityManager;
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            const transform = entity.components.get('Transform');

            if (animal && metabolism && transform) {
                this.processInternalMetabolism(id, entity, animal, metabolism, transform, dt);

                // 렌더러 디커플링을 위한 Visual 컴포넌트 동기화
                const visual = entity.components.get('Visual');
                if (visual) {
                    visual.isPooping = metabolism.isPooping;
                }
            }
        }
    }

    processInternalMetabolism(id, entity, animal, metabolism, transform, dt) {
        // 1. DIGESTION
        if (metabolism.stomach > 0) {
            const processRate = metabolism.digestionSpeed || 0.05;
            const amount = Math.min(metabolism.stomach, processRate * dt);
            metabolism.stomach -= amount;
            metabolism.storedFertility += amount;
        }

        // 2. EXCRETION
        const ix = Math.floor(transform.x);
        const iy = Math.floor(transform.y);
        const idx = iy * this.terrainGen.mapWidth + ix;
        const currentBiomeId = this.terrainGen.biomeBuffer[idx];
        const isInWater = [BIOME_NAMES_TO_IDS.get('OCEAN'), BIOME_NAMES_TO_IDS.get('DEEP_OCEAN'), BIOME_NAMES_TO_IDS.get('LAKE'), BIOME_NAMES_TO_IDS.get('RIVER')].includes(currentBiomeId);

        if (!isInWater && metabolism.storedFertility >= this.excreteThreshold) {
            metabolism.isPooping = true;
            this.eventBus.emit('SPAWN_POOP', { x: transform.x, y: transform.y, fertilityAmount: metabolism.storedFertility });
            metabolism.storedFertility = 0;
        } else if (metabolism.isPooping) {
            if (Math.random() < 0.05) metabolism.isPooping = false;
        }
    }
}