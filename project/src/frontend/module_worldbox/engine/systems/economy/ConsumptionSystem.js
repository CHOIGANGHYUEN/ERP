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
                this.processFeedingAI(id, entity, animal, metabolism, transform, state, dt);
            }
        }
    }

    processFeedingAI(id, entity, animal, metabolism, transform, state, dt) {
        // Environment Check (Water constraint)
        const ix = Math.floor(transform.x);
        const iy = Math.floor(transform.y);
        const idx = iy * this.engine.mapWidth + ix;
        const currentBiome = this.engine.terrainGen.biomeBuffer[idx];
        const isInWater = currentBiome === BIOMES.OCEAN;

        if (state.mode === 'wander') {
            const isHungry = metabolism.stomach < (metabolism.maxStomach || 2.0) * 0.7;
            if (isHungry && Math.random() < 0.05) {
                const targetId = this.findFood(animal, transform.x, transform.y);
                if (targetId !== null) {
                    state.mode = 'eat';
                    state.targetId = targetId;
                }
            }
        } else if (state.mode === 'eat') {
            const target = this.engine.entityManager.entities.get(state.targetId);
            if (!target) {
                state.mode = 'wander';
                state.targetId = null;
            } else {
                const targetPos = target.components.get('Transform');
                const dx = targetPos.x - transform.x;
                const dy = targetPos.y - transform.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 16) {
                    this.consume(id, state.targetId, animal, metabolism);
                    state.mode = 'wander';
                    state.targetId = null;
                    transform.vx = 0; transform.vy = 0;
                } else {
                    const dist = Math.sqrt(distSq);
                    const speed = animal.type === 'human' ? 55 : 45;
                    transform.vx = (dx / dist) * speed;
                    transform.vy = (dy / dist) * speed;
                }
            }
        }
    }

    findFood(animal, x, y) {
        let nearestId = null;
        let minDistSq = 62500; // 250px radius
        const em = this.engine.entityManager;

        for (const [id, entity] of em.entities) {
            const resource = entity.components.get('Resource');
            if (resource && (resource.isGrass || resource.isFruit)) {
                const pos = entity.components.get('Transform');
                const d2 = (pos.x - x) ** 2 + (pos.y - y) ** 2;
                if (d2 < minDistSq) {
                    minDistSq = d2;
                    nearestId = id;
                }
            }
        }
        return nearestId;
    }

    consume(myId, targetId, animal, metabolism) {
        const food = this.engine.entityManager.entities.get(targetId);
        if (food) {
            const visual = food.components.get('Visual');
            const nutrition = visual.quality || 0.5;
            metabolism.stomach = Math.min(metabolism.maxStomach || 2.0, metabolism.stomach + nutrition);
            this.engine.entityManager.removeEntity(targetId);
        }
    }
}