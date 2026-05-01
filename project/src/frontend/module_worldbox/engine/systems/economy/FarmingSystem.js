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

        const entities = this.entityManager.getEntitiesByComponent('Farm');
        for (const entity of entities) {
            this.processFarm(entity);
        }
    }

    processFarm(entity) {
        const farm = entity.components.get('Farm');
        const storage = entity.components.get('Storage');
        const transform = entity.components.get('Transform');

        if (!farm || !transform) return;

        // 지형 비옥도 확인
        const terrain = this.engine.terrainGen;
        const x = Math.floor(transform.x);
        const y = Math.floor(transform.y);
        const fertility = terrain.getFertilityAt ? terrain.getFertilityAt(x, y) : 50;

        // 성장 연산
        if (farm.growth < 100) {
            const boost = (fertility / 255) * farm.growthRate * 10;
            farm.growth = Math.min(100, farm.growth + boost);
        } else {
            // 수확 가능: Storage로 자원 이동 (간단한 자동 수확 예시)
            if (storage && !storage.isFull) {
                storage.addItem(farm.cropType, 10);
                farm.growth = 0; // 재파종 대기
                this.eventBus.emit('FARM_HARVESTED', { id: entity.id, type: farm.cropType });
            }
        }
    }
}
