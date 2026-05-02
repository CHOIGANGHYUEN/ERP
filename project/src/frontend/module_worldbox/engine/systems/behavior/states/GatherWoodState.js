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

        // 1. 타겟 탐색 (공통 메서드 위임)
        if (!state.targetId) {
            // 나무이면서 이미 쓰러지는 중이 아니고 자원이 남아있는 대상을 찾음
            const condition = (ent) => {
                const res = ent.components.get('Resource');
                const vis = ent.components.get('Visual');
                // 🌲 자원 인식률 강화: isTree 외에도 type 속성에 'tree'가 포함되어 있으면 나무로 인식
                if (!res || !(res.isTree || (res.type && res.type.includes('tree'))) || res.isFalling || res.value <= 0) return false;

                // 🌱 묘목 보호: 자원량이 적거나 덜 자란 새싹은 채집 대상에서 제외 (성목이 될 때까지 대기)
                if (res.value < 20 || (vis && vis.size < 10)) return false;

                // 🚫 도달 불가(블랙리스트) 타겟 필터링
                if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;

                // 🔒 타겟 독점 확인 (누군가 이미 캐려고 찜했는지)
                if (res.claimedBy && res.claimedBy !== entityId) {
                    const claimer = em.entities.get(res.claimedBy);
                    if (claimer) {
                        const claimerState = claimer.components.get('AIState');
                        if (claimerState && claimerState.targetId === ent.id) {
                            return false; // 누군가 이미 캐러 가고 있음
                        }
                    }
                    res.claimedBy = null; // 찜한 개체가 죽었거나 타겟을 바꿨으면 클레임 해제
                }

                return true;
            };

            const nearestId = em.findNearestEntityWithComponent(
                transform.x,
                transform.y,
                3000, // 🚀 탐색 반경 대폭 상향 (근처 숲이 초토화되어도 멀리 있는 나무를 찾아감)
                condition,
                this.system.engine.spatialHash
            );

            if (nearestId !== null) {
                state.targetId = nearestId;

                // 🔒 타겟 독점권 설정
                const targetEnt = em.entities.get(nearestId);
                const targetRes = targetEnt?.components.get('Resource');
                if (targetRes) targetRes.claimedBy = entityId;

                state.chopTimer = 0;
                state.isChopping = false;
                state.chopInterval = 0.4; // 0.4초마다 타격
            } else {
                return 'idle'; // 주변에 나무가 없으면 대기
            }
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
            const inventory = entity.components.get('Inventory');
            if (inventory) {
                // 한 번의 도끼질로 얻는 기본 획득량을 랜덤하게 보정 (기존 로직 유지)
                // 실제 추출된 amount를 기반으로 하지만 5~7 정도로 보정
                const woodGained = 5 + Math.floor(Math.random() * 3);
                inventory.add('wood', woodGained);
            }

            const state = entity.components.get('AIState');
            const targetId = state.targetId;
            const targetEnt = this.system.entityManager.entities.get(targetId);
            const tPos = targetEnt?.components.get('Transform');

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
