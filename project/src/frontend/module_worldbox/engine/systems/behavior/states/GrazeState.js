import { AnimalStates } from '../../../components/behavior/State.js';

export default class GrazeState {
    constructor(behaviorSystem) {
        this.bs = behaviorSystem;
    }

    update(id, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        const stats = entity.components.get('BaseStats');

        if (!state || !transform || !animal || !stats) return;

        // 1. 타겟 풀(자원)이 없으면 주변에서 탐색
        if (!state.targetId) {
            const nearestGrassId = this.findNearestGrass(transform, 150);
            if (nearestGrassId) {
                state.targetId = nearestGrassId;
            } else {
                return AnimalStates.WANDER; // 풀이 없으면 그냥 배회
            }
        }

        const target = this.bs.entityManager.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return;
        }

        const targetTransform = target.components.get('Transform');
        if (!targetTransform) {
            state.targetId = null;
            return;
        }

        const dist = Math.sqrt((transform.x - targetTransform.x)**2 + (transform.y - targetTransform.y)**2);

        // 2. 풀 근처에 도착하면 식사 시작
        if (dist < 5) {
            stats.hunger += dt * 15; // 허기 회복
            if (stats.hunger >= 100) {
                stats.hunger = 100;
                state.targetId = null;
                return AnimalStates.WANDER;
            }
            
            // 풀 자원 소모 (간단하게 엔티티 제거 또는 수치 감소)
            if (Math.random() < 0.05) {
                this.bs.entityManager.removeEntity(state.targetId);
                state.targetId = null;
            }
        } else {
            // 풀을 향해 이동
            const dx = targetTransform.x - transform.x;
            const dy = targetTransform.y - transform.y;
            const angle = Math.atan2(dy, dx);
            const moveSpeed = (this.bs.engine.speciesConfig[animal.type]?.moveSpeed || 40) * dt;
            
            transform.x += Math.cos(angle) * moveSpeed;
            transform.y += Math.sin(angle) * moveSpeed;
        }
    }

    findNearestGrass(transform, radius) {
        const nearbyIds = this.bs.spatialHash.query(transform.x, transform.y, radius);
        let nearestId = null;
        let minDist = radius;

        for (const id of nearbyIds) {
            const entity = this.bs.entityManager.entities.get(id);
            if (!entity) continue;
            
            const resource = entity.components.get('Resource');
            // pixel_grass 등 풀 계열 자원인지 확인
            if (resource && (resource.type === 'pixel_grass' || resource.type === 'grass')) {
                const resTransform = entity.components.get('Transform');
                const d = Math.sqrt((transform.x - resTransform.x)**2 + (transform.y - resTransform.y)**2);
                if (d < minDist) {
                    minDist = d;
                    nearestId = id;
                }
            }
        }
        return nearestId;
    }
}
