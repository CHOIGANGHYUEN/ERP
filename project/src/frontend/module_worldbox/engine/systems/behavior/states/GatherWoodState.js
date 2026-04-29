import State from './State.js';

export default class GatherWoodState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');

        if (!inventory || inventory.items.wood >= 50) {
            state.targetId = null;
            return 'wander'; // 목재를 충분히 모았으면 배회
        }

        const em = this.system.entityManager;

        // 나무 찾기
        if (!state.targetId) {
            let nearestId = null;
            let minDistSq = 160000; // 반경 400px
            for (const [id, targetEntity] of em.entities) {
                const res = targetEntity.components.get('Resource');
                if (res && res.isTree && res.value > 0) {
                    const tPos = targetEntity.components.get('Transform');
                    if (tPos) {
                        const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
                        if (distSq < minDistSq) {
                            minDistSq = distSq;
                            nearestId = id;
                        }
                    }
                }
            }

            if (nearestId) {
                state.targetId = nearestId;
            } else {
                return 'wander'; // 주변에 나무가 없으면 배회
            }
        }

        const target = em.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return null; // 나무가 사라짐
        }

        const tPos = target.components.get('Transform');
        const res = target.components.get('Resource');

        if (!tPos || !res || res.value <= 0) {
            state.targetId = null;
            return null;
        }

        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 나무에 도달
        if (distSq <= 100) {
            transform.vx = 0;
            transform.vy = 0;

            const gatherSpeed = 5 * dt;
            const amount = Math.min(res.value, gatherSpeed);
            res.value -= amount;
            inventory.add('wood', amount);

            if (res.value <= 0) {
                em.removeEntity(state.targetId);
                state.targetId = null;
                
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: tPos.x, y: tPos.y, count: 5, type: 'EFFECT', color: '#795548', speed: 2
                });
            }

        } else {
            const config = this.system.engine.speciesConfig[entity.components.get('Animal')?.type] || {};
            const speed = config.moveSpeed || 40;
            const dist = Math.sqrt(distSq);
            transform.vx = (dx / dist) * speed;
            transform.vy = (dy / dist) * speed;
        }

        return null;
    }
}
