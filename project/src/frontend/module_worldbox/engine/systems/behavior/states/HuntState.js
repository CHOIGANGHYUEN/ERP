import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

export default class HuntState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');

        const target = this.system.entityManager.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const targetAnimal = target.components.get('Animal');
        if (targetAnimal) {
            // 🔒 사냥감 독점 체크: 다른 개체가 먼저 찜했는지 확인
            if (targetAnimal.claimedBy && targetAnimal.claimedBy !== entityId) {
                const claimer = this.system.entityManager.entities.get(targetAnimal.claimedBy);
                const claimerState = claimer?.components.get('AIState');
                if (claimerState && claimerState.targetId === state.targetId) {
                    state.targetId = null; // 다른 사냥꾼에게 양보
                    if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                    return AnimalStates.IDLE;
                }
                targetAnimal.claimedBy = null;
            }
            targetAnimal.claimedBy = entityId; // 내가 찜함
        }

        const tPos = target.components.get('Transform');
        if (!tPos) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 2. 이동 (경로 탐색 적용)
        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 초근접 사거리 도달 시 공격/타격 루프 수행
        if (distSq <= 144) { // 12px 반경
            transform.vx *= 0.1;
            transform.vy *= 0.1;

            // ⚔️ [Damage Loop] 1초(60틱)마다 데미지 부여 (dt 누적 활용)
            state.attackCooldown = (state.attackCooldown || 0) - dt;
            if (state.attackCooldown <= 0) {
                const targetHealth = target.components.get('Health');
                const attackerStats = entity.components.get('BaseStats');
                const damage = attackerStats?.strength || 10;

                if (targetHealth) {
                    const isDead = targetHealth.takeDamage(damage);
                    if (isDead) {
                        // 사냥 성공 -> 식사 상태로 전이 (DeathProcessor가 아이템을 드랍할 것임)
                        return AnimalStates.EAT;
                    }
                } else {
                    // 체력 컴포넌트가 없는 구식 엔티티는 즉사 처리
                    return AnimalStates.EAT;
                }
                state.attackCooldown = 1.0; // 1초 쿨타임
            }
            return null; // 계속 추적/공격 중
        } else {
            // 🚀 [Troubleshooting 3] 동물도 장애물을 피해 타겟을 추적하도록 A* 적용
            // 🚀 [Bug Fix] 과도한 속도 배율(*60) 제거. BaseStats.speed는 이미 초당 픽셀 속도임.
            const stats = entity.components.get('BaseStats');
            const slowMult = stats?.injurySlowMultiplier || 1.0;
            const speed = (stats?.speed || 45) * 1.2 * slowMult; // 사냥 시에는 평소보다 20% 더 빠르게 질주
            // 🚀 [Expert Optimization] 사냥 중에는 경로를 500ms마다 재계산하여 먹잇감의 이동을 추적
            const result = Pathfinder.followPath(transform, state, tPos, speed, this.system.engine, 12, 500);
            
            if (result === -1) {
                state.failedPathCount = (state.failedPathCount || 0) + 1;
                
                // 3회 이상 실패 시 블랙리스트 등록 (20초간 무시)
                if (state.failedPathCount >= 3) {
                    state.blacklist.set(state.targetId, Date.now() + 20000);
                    state.targetId = null;
                    state.failedPathCount = 0;
                    if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '🚫', duration: 2000 });
                }
                return AnimalStates.IDLE;
            } else if (result === true) {
                // 도달 성공
                state.failedPathCount = 0;
                return AnimalStates.EAT;
            }
        }

        return null;
    }
}
