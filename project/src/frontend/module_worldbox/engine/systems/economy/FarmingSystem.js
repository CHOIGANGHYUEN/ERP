import System from '../../core/System.js';

/**
 * 🌾 FarmingSystem
 * 농장 타일 내 작물의 성장과 관리를 담당합니다.
 */
export default class FarmingSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.growthTick = 0;
    }

    update(dt, time) {
        this.growthTick += dt;
        if (this.growthTick < 5.0) return; // 5초마다 성장 업데이트
        this.growthTick = 0;

        const em = this.entityManager;
        // 🚀 [Optimization] buildingIds 인덱스 활용
        for (const id of em.buildingIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            
            const farm = entity.components.get('Farm');
            if (farm) {
                this.processFarm(id, entity, farm);
            }
        }
    }

    processFarm(id, entity, farm) {
        const storage = entity.components.get('Storage');
        const transform = entity.components.get('Transform');
        const structure = entity.components.get('Structure');

        // 건설이 완료된 농장만 작동
        if (!farm || !transform || (structure && !structure.isComplete)) return;

        // 지형 비옥도 확인 (0~255)
        const terrain = this.engine.terrainGen;
        const x = Math.floor(transform.x);
        const y = Math.floor(transform.y);
        const fertility = terrain.getFertilityAt ? terrain.getFertilityAt(x, y) : 50;

        // 성장 연산
        if (farm.currentCrops === undefined) farm.currentCrops = 0;
        if (farm.growth === undefined) farm.growth = 0;

        if (farm.currentCrops < (farm.maxCrops || 10)) {
            const fertilityMult = (fertility / 255) + 0.2; // 비옥도 가중치
            farm.growth += (farm.growthRate || 0.05) * fertilityMult * 5;

            if (farm.growth >= 100) {
                farm.growth = 0;
                farm.currentCrops++;
                this.eventBus.emit('CROP_GROWN', { id, x: transform.x, y: transform.y });
            }
        }

        // 수확 시점 (작물이 어느 정도 찼을 때)
        if (farm.currentCrops >= (farm.maxCrops || 10) * 0.8) {
            if (storage && !storage.isFull) {
                const harvested = farm.currentCrops;
                storage.addItem(farm.cropType || 'wheat', harvested);
                farm.currentCrops = 0;
                farm.growth = 0;
                console.log(`🌾 Farm ${id} harvested ${harvested} units of ${farm.cropType}`);
                this.eventBus.emit('FARM_HARVESTED', { id, amount: harvested });
            }
        }
    }
}
