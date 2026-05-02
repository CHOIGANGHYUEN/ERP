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

        // 초근접 사거리 도달 시 식사 상태로 전환
        if (distSq <= 144) { // 12px 반경
            transform.vx *= 0.5;
            transform.vy *= 0.5;
            return AnimalStates.EAT;
        } else {
            // 🚀 [Troubleshooting 3] 동물도 장애물을 피해 타겟을 추적하도록 A* 적용
            const speed = (entity.components.get('BaseStats')?.speed || 1.0) * 60; // 초당 60px 내외
            if (Pathfinder.followPath(transform, state, tPos, speed, this.system.engine) === -1) {
                // 도달 불가한 사냥감일 경우 추적 포기
                state.targetId = null;
                if (this.system.eventBus) this.system.eventBus.emit('SHOW_SPEECH_BUBBLE', { entityId, text: '❓', duration: 1500 });
                return AnimalStates.IDLE;
            }
        }

        return null;
    }
}
