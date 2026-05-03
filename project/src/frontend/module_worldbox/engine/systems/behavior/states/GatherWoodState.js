import GatherState from './GatherState.js';

/**
 * 🪓 GatherWoodState
 * 인간이 나무를 찾아가 도끼로 패고 목재를 수집하는 상태입니다.
 * 하드코딩 로직은 GatherState와 ResourceNode로 위임되었습니다.
 */
export default class GatherWoodState extends GatherState {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const inventory = entity.components.get('Inventory');
        const transform = entity.components.get('Transform');
        const em = this.system.entityManager;

        // 🍂 1. 쓰러지는 나무를 지켜보는 상태 (Fall Phase 연출)
        if (state.fallingTargetId) {
            const target = em.entities.get(state.fallingTargetId);
            if (target) {
                const res = target.components.get('Resource');
                if (res) {
                    state.fallTimer = (state.fallTimer || 0) + dt;
                    res.fallProgress = Math.min(1.0, state.fallTimer / 1.5);

                    const visual = target.components.get('Visual');
                    if (visual) {
                        visual.isFalling = true;
                        visual.fallProgress = res.fallProgress;
                    }

                    // 1.5초 뒤 나무가 완전히 쓰러지면 삭제 처리
                    if (state.fallTimer >= 1.5) {
                        em.removeEntity(state.fallingTargetId);

                        // 🌱 생태계 복원 (5~10초 뒤 묘목 스폰)
                        const tPos = target.components.get('Transform');
                        if (tPos) {
                            const engine = this.system.engine;
                            setTimeout(() => {
                                if (engine?.spawner?.spawnPlant) engine.spawner.spawnPlant(tPos.x, tPos.y, 'tree');
                            }, 5000 + Math.random() * 5000);
                        }

                        state.fallingTargetId = null;
                        state.fallTimer = 0;
                        return 'idle'; // 벌목 완료 후 대기
                    }

                    // 지켜보는 동안 이동 정지
                    if (transform) { transform.vx = 0; transform.vy = 0; }
                    return 'gather_wood'; // 연출이 끝날 때까지 상태 유지
                }
            }
            state.fallingTargetId = null;
            state.fallTimer = 0;
        }

        // 인벤토리가 꽉 찼으면 복귀
        if (!inventory || inventory.getTotal() >= inventory.capacity) {
            state.targetId = null;
            state.isChopping = false;
            return 'idle';
        }

        // 1. 타겟 탐색 (중앙 관제에 요청)
        if (!state.targetId) {
            // 타겟 요청 실패 시 처리 (2초 후 재시도)
            if (state.targetRequestFailed) {
                state.retryTimer = (state.retryTimer || 0) + dt;
                if (state.retryTimer >= 2.0) {
                    state.targetRequestFailed = false;
                    state.isTargetRequested = false;
                    state.retryTimer = 0;
                }
                
                // 대기 중 두리번거리는 연출 (속도 감속)
                if (transform) {
                    transform.vx *= 0.5;
                    transform.vy *= 0.5;
                }
                return null; 
            }

            if (!state.isTargetRequested) {
                const targetManager = this.system.engine.systemManager.targetManager;
                if (targetManager) {
                    targetManager.requestTarget(entityId, 'RESOURCE', { resourceType: 'wood' }, 'gather_wood');
                    state.isTargetRequested = true;
                }
            }
            
            // ⏳ 내부 대기 연출
            if (transform) {
                transform.vx *= 0.5;
                transform.vy *= 0.5;
            }
            return null;
        }

        // 2. 이동 및 채집 (부모 클래스 위임)
        const nextState = this.executeMovementAndGathering(entityId, entity, dt, 144);

        // 🚀 [중요 복구] 
        // 부모 클래스가 나무 체력 0을 감지하고 'idle'로 가라고 지시하더라도,
        // 방금 onGatherSuccess에서 fallingTargetId가 세팅되었다면 무시하고 현재 상태를 유지시킵니다.
        if (state.fallingTargetId) {
            return 'gather_wood';
        }

        return nextState;
    }

    /**
     * 자원 획득 성공 시 인벤토리 적재
     */
    onGatherSuccess(entity, amount, resourceNode) {
        if (amount > 0) {
            const state = entity.components.get('AIState');
            const targetId = state.targetId;
            const targetEnt = this.system.entityManager.entities.get(targetId);
            const tPos = targetEnt?.components.get('Transform');

            // 📦 [User Request] 인벤토리에 즉시 넣지 않고 바닥에 드랍함
            const itemFactory = this.system.engine.factoryProvider.get('item');
            if (itemFactory && tPos) {
                const woodGained = 5 + Math.floor(Math.random() * 3);
                itemFactory.spawnDrop(tPos.x, tPos.y, 'wood', woodGained);
            }

            // 🪓 나무 팰 때마다 나무 파편(파티클) 튀는 타격감 추가
            if (tPos && this.system.eventBus) {
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: tPos.x, y: tPos.y - 15, count: 4, type: 'EFFECT', color: '#8d6e63', speed: 2
                });
            }

            // 🌲 자원 고갈 시: 나무가 쓰러지는 모션 적용 및 완전히 삭제
            if (resourceNode.value <= 0 && !resourceNode.isFalling) {
                resourceNode.isFalling = true;
                resourceNode.fallProgress = 0;

                // 개체가 나무를 때리는 위치에 따라 자연스럽게 반대 방향으로 넘어지도록 설정
                const entityTransform = entity.components.get('Transform');
                resourceNode.fallDirection = (entityTransform && tPos && entityTransform.x < tPos.x) ? 1 : -1;

                if (targetEnt) {
                    const visual = targetEnt.components.get('Visual');
                    if (visual) {
                        visual.isFalling = true;
                        visual.fallDirection = resourceNode.fallDirection;
                        visual.fallProgress = 0;
                    }
                }

                // 비동기 타이머 대신 상태 기계로 위임하여 게임 루프가 쓰러짐 연출과 삭제를 완벽히 통제하도록 함
                state.fallingTargetId = targetId;
                state.fallTimer = 0;
            }
        }
    }
}
