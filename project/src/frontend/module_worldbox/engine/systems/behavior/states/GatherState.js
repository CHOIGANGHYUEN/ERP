import State from './State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🌿 GatherState (추상화 부모 클래스)
 * 타겟을 향한 이동과 채집 가능 거리 판별을 수행하는 기반 상태 클래스입니다.
 */
export default class GatherState extends State {
    /**
     * 타겟을 향해 이동하거나, 사거리 내에 도달하면 채집을 수행합니다.
     * @param {number} entityId 
     * @param {object} entity 
     * @param {number} dt 
     * @param {number} gatherRangeSq - 채집 가능 거리의 제곱
     * @returns {string|null} - 다음 상태를 반환하거나 유지(null)
     */
    executeMovementAndGathering(entityId, entity, dt, gatherRangeSq) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const gatherer = entity.components.get('GathererComponent');
        const em = this.system.entityManager;
        const target = em.entities.get(state.targetId);

        // 타겟이 없거나 유효하지 않으면 상태 종료
        if (!target || !transform || !gatherer) {
            state.targetId = null;
            state.isChopping = false;
            return 'idle';
        }

        const tPos = target.components.get('Transform');
        const res = target.components.get('Resource');

        if (!tPos || !res || res.value <= 0) {
            state.targetId = null;
            state.isChopping = false;
            return 'idle';
        }

        // 🔒 타겟 독점 (Claim) 체크: 여러 명의 개체가 겹쳐서 같은 자원을 캐는 것을 매 프레임 방어
        if (res.claimedBy && res.claimedBy !== entityId) {
            const claimer = em.entities.get(res.claimedBy);
            const claimerState = claimer?.components.get('AIState');
            if (claimerState && claimerState.targetId === state.targetId) {
                state.targetId = null; // 🙋‍♂️ 다른 개체가 먼저 선점했으므로 즉시 양보하고 포기함
                state.isChopping = false;
                if (this.system.eventBus) {
                    this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                }
                return 'idle';
            }
            res.claimedBy = null;
        }
        res.claimedBy = entityId; // 나의 독점권 갱신 및 유지

        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 사거리 내에 도달했는지 확인
        if (distSq <= gatherRangeSq) {
            // 멈추기
            if (transform.vx !== undefined) transform.vx *= 0.5;
            if (transform.vy !== undefined) transform.vy *= 0.5;
            state.isChopping = true;

            // 채집 쿨다운 (도끼질 타이머)
            state.chopTimer = (state.chopTimer || 0) + dt;
            const chopInterval = state.chopInterval || 0.8; // 기본 0.8초 간격

            if (state.chopTimer >= chopInterval) {
                state.chopTimer = 0; // 타이머 초기화

                // 💎 [Specialization Multiplier] 마을 보너스 계산
                let multiplier = 1.0;
                const civ = entity.components.get('Civilization');
                if (civ && civ.villageId !== -1) {
                    const vs = this.system.engine.systemManager?.villageSystem;
                    const village = vs?.getVillage(civ.villageId);
                    if (village && village.buffs) {
                        const resType = res.type?.toLowerCase();
                        if (resType === 'tree') multiplier = village.buffs.woodGatherRate || 1.0;
                        else if (['stone', 'iron_ore', 'ore'].includes(resType)) multiplier = village.buffs.stoneGatherRate || 1.0;
                        else if (['berry', 'food'].includes(resType)) multiplier = village.buffs.foodGatherRate || 1.0;
                    }
                }

                // ⚔️ [Action Loop] 실제 채집(타격) 로직 실행
                const extracted = gatherer.performGathering(
                    chopInterval, // 간격만큼의 채집량 적용
                    target,
                    state.targetId,
                    em,
                    this.system.eventBus,
                    transform,
                    multiplier // 보너스 배율 전달
                );

                // 자식 클래스에서 오버라이드할 콜백 (애니메이션 연출 등)
                this.onGatherSuccess(entity, extracted, res);
            }

            const targetHealth = target.components.get('Health');
            
            // 🛑 [Termination] 체력이 0이 되었거나 타겟이 삭제되었다면 루프 종료
            if ((targetHealth && targetHealth.currentHp <= 0) || res.value <= 0) {
                state.targetId = null;
                state.isChopping = false;
                return 'idle';
            }
        } else {
            // 사거리 밖이면 이동
            state.isChopping = false;
            const moveStatus = Pathfinder.followPath(transform, state, tPos, 55, this.system.engine);

            if (moveStatus === -1) {
                // 🚫 [Timed Blacklist] 길찾기 실패 시 30초간 무시 (이후 다시 시도 가능)
                if (state.addToBlacklist) {
                    state.addToBlacklist(state.targetId, 30);
                } else {
                    if (!state.unreachableTargets) state.unreachableTargets = new Set();
                    state.unreachableTargets.add(state.targetId);
                }

                state.targetId = null; // 길 없음 (포기)
                if (this.system.eventBus) {
                    this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                }
                return 'idle';
            }
        }

        return null;
    }

    /**
     * 자원 획득 시 호출되는 콜백. 자식 클래스에서 재정의합니다.
     */
    onGatherSuccess(entity, amount, resourceNode) {
        // 기본적으로 아무것도 하지 않음.
    }
}
