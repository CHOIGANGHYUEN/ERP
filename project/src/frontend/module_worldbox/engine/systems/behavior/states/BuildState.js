import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🔨 BuildState
 * 건축가가 청사진(Blueprint)으로 이동하는 상태를 관리합니다.
 */
export default class BuildState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const em = this.system.entityManager;

        if (!state || !state.targetId) return AnimalStates.IDLE;

        const target = em.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const tPos = target.components.get('Transform');
        // 🚀 좌표가 없거나 잘못된 경우 IDLE로 복귀하여 재탐색 유도
        if (!tPos || isNaN(tPos.x) || isNaN(tPos.y)) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 🏗️ 청사진(목표)으로 이동
        const speed = 80; // 건설 현장으로 달려가는 속도 상향
        
        // Pathfinder를 통해 실제 이동 수행
        const isReached = Pathfinder.followPath(transform, state, tPos, speed, this.system.engine);
        
        // 도착했으면 멈춰서 건설 (실제 건설 노동은 ConstructionSystem에서 처리)
        if (isReached) {
            transform.vx = 0;
            transform.vy = 0;
        }

        // 경로를 찾지 못하거나 이동이 불가능한 경우를 대비해 null 반환 (상태 유지)
        // 만약 계속 못 움직인다면 Pathfinder 내부에서 처리가 필요함
        return null;
    }
}
