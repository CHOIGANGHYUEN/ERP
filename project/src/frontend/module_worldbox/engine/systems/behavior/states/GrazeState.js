import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🌿 GrazeState
 * 초식동물이 풀을 찾아가 '공격(타격)'하여 아이템을 드랍시키는 상태입니다.
 * 실제 섭취는 드랍된 아이템을 통해 EatState에서 처리됩니다.
 */
export default class GrazeState {
    constructor(behaviorSystem) {
        this.bs = behaviorSystem;
    }

    update(id, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        const stats = entity.components.get('BaseStats');

        if (!state || !transform || !animal || !stats) return null;

        // 1. 타겟 풀(자원)이 없으면 주변에서 탐색 (살아있는 풀)
        if (!state.targetId) {
            const nearestGrassId = this.findNearestGrass(transform, 200);
            if (nearestGrassId) {
                state.targetId = nearestGrassId;
            } else {
                return AnimalStates.WANDER;
            }
        }

        const target = this.bs.entityManager.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const targetTransform = target.components.get('Transform');
        const health = target.components.get('Health');
        if (!targetTransform || !health) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 2. 풀 근처에 도착하면 타격 루프 시작
        if (distSq < 400) { // 20px 반경
            transform.vx = 0;
            transform.vy = 0;

            state.attackCooldown = (state.attackCooldown || 0) - dt;
            if (state.attackCooldown <= 0) {
                // 풀을 뜯어 데미지 입힘
                const damage = 10;
                const isDead = health.takeDamage(damage);
                
                const targetVisual = target.components.get('Visual');
                GlobalLogger.info(`${animal.type.toUpperCase()} is grazing on ${targetVisual?.type || 'resource'}.`);
                
                // 시각 효과 (풀 조각 튀기)
                if (this.bs.eventBus) {
                    this.bs.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: targetTransform.x, y: targetTransform.y, count: 3, type: 'EFFECT', color: '#4caf50'
                    });
                }

                if (isDead) {
                    // 🌿 [FIX] 아이템 드롭 책임은 DeathProcessor로 일원화 (중복 및 하드코딩 제거)
                    state.targetId = null;
                    return AnimalStates.FORAGE;
                }
                state.attackCooldown = 0.8; // 0.8초 쿨타임
            }
        } else {
            // 🚀 [User Request] 직선 이동 대신 Pathfinder 적용 (장애물 회피)
            const speed = (this.bs.engine.speciesConfig[animal.type]?.moveSpeed || 40);
            if (Pathfinder.followPath(transform, state, targetTransform, speed, this.bs.engine) === -1) {
                state.targetId = null;
                return AnimalStates.WANDER;
            }
        }
        return null;
    }

    findNearestGrass(transform, radius) {
        const nearbyIds = this.bs.spatialHash.query(transform.x, transform.y, radius);
        let nearestId = null;
        let minDistSq = radius * radius;

        for (const id of nearbyIds) {
            const entity = this.bs.entityManager.entities.get(id);
            if (!entity) continue;
            
            const resource = entity.components.get('Resource');
            const health = entity.components.get('Health');
            
            if (!resource) continue;

            // 살아있는 식물 계열 자원인지 확인 (정상화된 모든 식용 자원 포함)
            const type = resource.type;
            const config = this.bs.engine.resourceConfig[type];
            if ((config?.edible || type.includes('grass') || type.includes('flower') || type.includes('plant') || type.includes('reed') || type.includes('vine') || type.includes('shrub'))) {
                if (health && health.currentHp > 0) {
                    const resTransform = entity.components.get('Transform');
                    const dx = transform.x - resTransform.x;
                    const dy = transform.y - resTransform.y;
                    const dSq = dx * dx + dy * dy;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        nearestId = id;
                    }
                }
            }
        }
        return nearestId;
    }
}
