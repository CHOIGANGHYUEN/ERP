import System from '../../core/System.js';

/**
 * 🧺 GatheringSystem
 * 본능 행동 (포식, 채집)에 대한 시스템
 * 장황한 거리 계산과 차감 로직은 GathererComponent로 위임되었습니다.
 */
export default class GatheringSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.updateAccumulator = 0; // 🚀 [Optimization]
    }

    update(dt, time) {
        this.updateAccumulator += dt;
        if (this.updateAccumulator < 0.1) return; // 10Hz로 제한
        
        const effectiveDt = this.updateAccumulator;
        this.updateAccumulator = 0;

        const em = this.entityManager;
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;
            
            const state = entity.components.get('AIState');
            if (!state || !state.targetId) continue;

            const gatherer = entity.components.get('GathererComponent');
            if (!gatherer) continue;

            const targetId = state.targetId;
            const target = targetId ? em.entities.get(targetId) : null;
            if (!target) continue;

            const transform = entity.components.get('Transform');
            const targetPos = target.components.get('Transform');
            
            if (!transform || !targetPos) continue;

            const distSq = (targetPos.x - transform.x) ** 2 + (targetPos.y - transform.y) ** 2;

            if (state.mode === 'eat') {
                if (distSq <= 25) { // 반경 5px
                    gatherer.gatherSpeed = 10.0;
                    const extracted = gatherer.performGathering(effectiveDt, target, targetId, em, this.eventBus, transform);
                    
                    const preyAnimal = target.components.get('Animal');
                    if (preyAnimal && extracted === 0) {
                        // 사냥감 처리
                        const stats = entity.components.get('BaseStats');
                        if (stats) stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + 50);
                        em.removeEntity(targetId);
                    } else if (extracted > 0) {
                        const stats = entity.components.get('BaseStats');
                        if (stats) stats.hunger = Math.min(stats.maxHunger || 100, stats.hunger + extracted);
                    }
                }
            } else if (state.mode === 'bee_gather') {
                if (distSq <= 25) { // 반경 5px
                    // 벌은 한 번에 20의 비옥도를 소모하여 10의 꿀을 얻음
                    gatherer.gatherSpeed = 20.0 / effectiveDt; 
                    const extracted = gatherer.performGathering(effectiveDt, target, targetId, em, this.eventBus, transform);
                    
                    const animal = entity.components.get('Animal');
                    if (animal) animal.nectar = (animal.nectar || 0) + 10;
                    state.mode = 'bee_return'; 
                }
            } else if (state.mode === 'gather') {
                if (distSq <= 100) { // 반경 10px
                    gatherer.gatherSpeed = 5.0;
                    const extracted = gatherer.performGathering(effectiveDt, target, targetId, em, this.eventBus, transform);
                    
                    if (extracted > 0) {
                        const inventory = entity.components.get('Inventory');
                        const wealth = entity.components.get('Wealth');
                        const resource = target.components.get('Resource');
                        if (inventory && resource) {
                            const type = resource.type || 'wood';
                            // 직접 수정 대신 컴포넌트 메서드 사용 (캡슐화 준수)
                            inventory.add(type, extracted);
                        }
                        if (wealth) wealth.addGold(extracted * 0.1);
                    }
                }
            }
        }
    }
}
