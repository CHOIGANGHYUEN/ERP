import { BIOMES } from '../../world/TerrainGen.js';

export default class ConsumptionSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            const transform = entity.components.get('Transform');
            const state = entity.components.get('AIState');

            if (animal && metabolism && transform && state) {
                // This system now ONLY handles the final act of consumption
                // when an entity is in the 'eat' state and near its target.
                if (state.mode === 'eat') {
                    const target = em.entities.get(state.targetId);

                    if (target) {
                        const targetPos = target.components.get('Transform');
                        const dx = targetPos.x - transform.x;
                        const dy = targetPos.y - transform.y;
                        const distSq = dx * dx + dy * dy;

                        // If close enough, consume the food.
                        // The BehaviorSystem will see the target is gone and switch state to 'wander'.
                        if (distSq < 25) {
                            this.consume(id, state.targetId, animal, metabolism);
                        }
                    }
                }
            }
        }
    }

    consume(myId, targetId, animal, metabolism) {
        const food = this.engine.entityManager.entities.get(targetId);
        if (food) {
            const resource = food.components.get('Resource');
            const visual = food.components.get('Visual');
            const preyAnimal = food.components.get('Animal');

            let nutrition = 0.5;
            if (resource && resource.storedFertility !== undefined) nutrition = resource.storedFertility;
            else if (resource && resource.amount) nutrition = 2.0; // 자원 고기 등
            else if (preyAnimal) nutrition = 3.0; // 사냥 성공 시 큰 포만감 제공
            else if (visual && visual.quality) nutrition = visual.quality;

            metabolism.stomach = Math.min(metabolism.maxStomach || 2.0, metabolism.stomach + nutrition);
            this.engine.entityManager.removeEntity(targetId);

            // 사냥당한 경우 붉은색 피(Blood) 파티클 이펙트
            if (preyAnimal) {
                const pos = food.components.get('Transform');
                if (pos) {
                    for (let i = 0; i < 8; i++) {
                        this.engine.particles.push({
                            x: pos.x + (Math.random() - 0.5) * 10,
                            y: pos.y + (Math.random() - 0.5) * 10,
                            targetY: pos.y + 5 + Math.random() * 10,
                            type: 'EFFECT',
                            color: '#e53935',
                            speed: 1 + Math.random() * 2
                        });
                    }
                }
            }
        }
    }
}