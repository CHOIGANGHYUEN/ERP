import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🔨 BuildState
 * 건축가가 청사진(Blueprint)으로 이동하는 상태를 관리합니다.
 * 실제 건설 노동(progress 증가)은 ConstructionSystem에서 처리합니다.
 */
export default class BuildState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const em = this.system.entityManager;

        if (!state.targetId) return AnimalStates.IDLE;

        const target = em.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const tPos = target.components.get('Transform');
        if (!tPos) return AnimalStates.IDLE;

        // 청사진(목표)으로 이동
        const speed = 70; // 건설 현장으로 달려가는 속도
        const isReached = Pathfinder.followPath(transform, state, tPos, speed, this.system.engine);
        
        // 도착했으면 ConstructionSystem이 작업하도록 대기 (상태 유지)
        if (isReached) {
            transform.vx *= 0.5;
            transform.vy *= 0.5;
        }

        return null;
    }
}
