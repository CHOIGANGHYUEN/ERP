import System from '../../core/System.js';

export default class ConstructionSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
    }

    update(dt, time) {
        const em = this.entityManager;
        
        // 지능 개체(건축가)가 자원을 모아 청사진을 완성하는 로직
        for (const [id, entity] of em.entities) {
            const builder = entity.components.get('Builder');
            const transform = entity.components.get('Transform');
            const state = entity.components.get('AIState');
            const inventory = entity.components.get('Inventory');

            if (builder && transform && state && inventory) {
                if (state.mode === 'build') {
                    const target = em.entities.get(state.targetId);
                    if (target) {
                        const targetPos = target.components.get('Transform');
                        const structure = target.components.get('Structure');
                        
                        if (!structure || structure.isComplete) {
                            state.mode = 'wander';
                            state.targetId = null;
                            continue;
                        }

                        const distSq = (targetPos.x - transform.x) ** 2 + (targetPos.y - transform.y) ** 2;

                        // 사거리 도달
                        if (distSq <= 400) { // 반경 20px
                            transform.vx = 0;
                            transform.vy = 0;
                            
                            // 건물 완성도 증가
                            const progressAmount = builder.buildSpeed * dt;
                            structure.progress += progressAmount;

                            // 목재 소모 (일정 주기로 조금씩)
                            if (Math.random() < 0.1 && inventory.items.wood > 0) {
                                inventory.items.wood -= 1;
                            }

                            if (structure.progress >= structure.maxProgress) {
                                structure.progress = structure.maxProgress;
                                this.engine.buildingFactory.completeBuilding(state.targetId);
                                state.mode = 'wander';
                                state.targetId = null;

                                this.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                                    x: targetPos.x, y: targetPos.y, count: 20, type: 'EFFECT', color: '#ffeb3b', speed: 5
                                });
                            }
                        } else {
                            // 청사진을 향해 이동
                            const config = this.engine.speciesConfig[entity.components.get('Animal')?.type] || {};
                            const speed = config.moveSpeed || 40;
                            const dist = Math.sqrt(distSq);
                            transform.vx = (targetPos.x - transform.x) / dist * speed;
                            transform.vy = (targetPos.y - transform.y) / dist * speed;
                        }
                    } else {
                        state.mode = 'wander';
                        state.targetId = null;
                    }
                }
            }
        }
    }
}
