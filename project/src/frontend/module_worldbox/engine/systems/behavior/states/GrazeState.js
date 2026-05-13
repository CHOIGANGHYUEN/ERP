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

        // 🛡️ [Busy Protection] 식사(방목) 중에는 중단되지 않도록 보호
        state.interruptible = false;

        // 1. 타겟 풀(자원)이 없으면 주변에서 탐색 (살아있는 풀)
        if (!state.targetId) {
            // 🚀 [Time-slicing] 이번 프레임에 탐색 권한이 있을 때만 수행
            if (state.canSearchThisFrame) {
                const nearestGrassId = this.findNearestGrass(transform, 250);
                if (nearestGrassId) {
                    state.targetId = nearestGrassId;
                } else {
                    return AnimalStates.WANDER;
                }
            } else {
                // 탐색 권한이 없으면 이번 프레임은 대기 (IDLE 유지 또는 약간의 방황)
                return null; 
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
                // 풀을 뜯어 데미지 입힘 (10 데미지)
                const damage = 10;
                const isDead = health.takeDamage(damage);
                
                // 📊 BaseStats 동기화 (자원의 HP 버퍼 업데이트)
                const targetStats = target.components.get('BaseStats');
                if (targetStats) targetStats.takeDamage(damage);

                const targetVisual = target.components.get('Visual');
                GlobalLogger.info(`${animal.type.toUpperCase()} is grazing on ${targetVisual?.type || 'resource'}.`);
                
                // 시각 효과 (풀 조각 튀기)
                if (this.bs.eventBus) {
                    this.bs.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                        x: targetTransform.x, y: targetTransform.y, count: 3, type: 'EFFECT', color: '#4caf50'
                    });
                    
                    // 🚀 [Expert Feedback] 플로팅 데미지 텍스트 생성
                    this.bs.eventBus.emit('SPAWN_FLOATING_TEXT', {
                        x: targetTransform.x, y: targetTransform.y - 5,
                        text: `-${Math.round(damage)}`,
                        color: '#ff4d4d',
                        options: { size: 14, vy: -1.5 }
                    });
                }

                if (isDead) {
                    state.targetId = null;
                    return AnimalStates.IDLE;
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
        let nearestId = null;
        let minDistSq = radius * radius;

        // 🚀 [Expert Optimization] eachInRange 대신 eachInSpiral 사용하여 근접한 것부터 탐색
        this.bs.spatialHash.eachInSpiral(transform.x, transform.y, radius, (id) => {
            const entity = this.bs.entityManager.entities.get(id);
            if (!entity) return false;
            
            const resource = entity.components.get('Resource');
            const health = entity.components.get('Health');
            
            if (!resource) return false;

            const config = this.bs.engine.resourceConfig[resource.type];
            // 🎯 [Balanced Identification] 카테고리가 풀/식물이거나 설정상 edible이면 허용하되, 나무(tree)는 절대 금지
            const cat = resource.category || config?.type || 'resource';
            const isTree = (cat === 'tree' || resource.type.toLowerCase().includes('tree'));
            const isEdible = (cat === 'grass' || cat === 'plant' || cat === 'food' || config?.edible);

            if (isEdible && !isTree) {
                if (health && health.currentHp > 0) {
                    const resTransform = entity.components.get('Transform');
                    if (!resTransform) return false;
                    const dx = transform.x - resTransform.x;
                    const dy = transform.y - resTransform.y;
                    const dSq = dx * dx + dy * dy;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        nearestId = id;
                        return true; // 가장 가까운 것을 찾았으므로 즉시 종료
                    }
                }
            }
            return false;
        });
        return nearestId;
    }
}
