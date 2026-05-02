import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🌿 ForageState (초식동물 전용 수색/이동 상태)
 */
export default class ForageState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');

        const target = this.system.entityManager.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const res = target.components.get('Resource');
        const aComp = target.components.get('Animal');

        if (res) {
            // 🔒 먹이 독점 체크 (다른 초식동물이 먼저 발견했는지)
            if (res.claimedBy && res.claimedBy !== entityId) {
                const claimer = this.system.entityManager.entities.get(res.claimedBy);
                const claimerState = claimer?.components.get('AIState');
                if (claimerState && claimerState.targetId === state.targetId) {
                    state.targetId = null; // 양보
                    if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                    return AnimalStates.IDLE;
                }
                res.claimedBy = null;
            }
            res.claimedBy = entityId;
        } else if (aComp) {
            // 🔒 인간 등 잡식동물이 Forage 상태로 사냥감을 추적할 때의 독점 체크
            if (aComp.claimedBy && aComp.claimedBy !== entityId) {
                const claimer = this.system.entityManager.entities.get(aComp.claimedBy);
                const claimerState = claimer?.components.get('AIState');
                if (claimerState && claimerState.targetId === state.targetId) {
                    state.targetId = null; // 양보
                    if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                    return AnimalStates.IDLE;
                }
                aComp.claimedBy = null;
            }
            aComp.claimedBy = entityId;
        }

        const tPos = target.components.get('Transform');
        if (!tPos) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 초근접 사거리 도달 시 식사 상태로 전환
        if (distSq <= 144) {
            transform.vx *= 0.5;
            transform.vy *= 0.5;
            return AnimalStates.EAT;
        } else {
            // 🚀 [Troubleshooting 3] 초식동물도 장애물(건물)을 피해 먹이를 찾도록 A* 적용
            // 🚀 [Bug Fix] 과도한 속도 배율(*50) 제거. BaseStats.speed는 이미 초당 픽셀 속도임.
            const stats = entity.components.get('BaseStats');
            const speed = (stats?.speed || 40); 
            
            if (Pathfinder.followPath(transform, state, tPos, speed, this.system.engine) === -1) {
                // 🌊 도달할 수 없는 곳(바다 건너)이면 즉시 포기
                state.targetId = null;
                if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                return AnimalStates.IDLE;
            }
        }

        return null;
    }
}
