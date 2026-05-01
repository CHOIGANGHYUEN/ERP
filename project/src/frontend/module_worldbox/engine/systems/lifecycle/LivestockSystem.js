import System from '../../core/System.js';

/**
 * 🐄 LivestockSystem
 * 가축의 성장, 번식 및 축산물 생산을 관리합니다.
 */
export default class LivestockSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.productionTick = 0;
    }

    update(dt, time) {
        this.productionTick += dt;
        if (this.productionTick < 10.0) return; // 10초마다 생산 업데이트
        this.productionTick = 0;

        const animals = this.entityManager.getEntitiesByComponent('Animal');
        for (const entity of animals) {
            const animal = entity.components.get('Animal');
            // 가축으로 분류된 동물들 처리 (sheep, cow 등)
            if (animal && (animal.type === 'sheep' || animal.type === 'cow')) {
                this.processLivestock(entity, animal);
            }
        }
    }

    processLivestock(entity, animal) {
        const stats = entity.components.get('BaseStats');
        if (!stats || stats.hunger < 40) return; // 배고프면 생산 안함

        // 부산물 생산 (예: 양털, 우유)
        const productType = animal.type === 'sheep' ? 'wool' : 'milk';
        
        // 주변에 수집가가 있거나 창고가 있다면 이벤트 발생
        this.eventBus.emit('LIVESTOCK_PRODUCED', { 
            type: productType, 
            amount: 1, 
            x: entity.components.get('Transform').x,
            y: entity.components.get('Transform').y
        });
    }
}
