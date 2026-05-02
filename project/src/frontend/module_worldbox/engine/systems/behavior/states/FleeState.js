import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';
import Pathfinder from '../../../utils/Pathfinder.js';

/**
 * 🏃 FleeState (도망 상태)
 * 위협으로부터 벗어나기 위해 장애물을 피해 도망칩니다.
 */
export default class FleeState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        
        const threat = this.system.entityManager.entities.get(state.targetId);
        if (!threat) {
            state.targetId = null;
            state.fleePos = null;
            return AnimalStates.IDLE;
        }

        const tPos = threat.components.get('Transform');
        if (!tPos) return AnimalStates.IDLE;

        const dx = transform.x - tPos.x;
        const dy = transform.y - tPos.y;
        const distSq = dx * dx + dy * dy;

        // 1. 충분히 멀어지면(반경 400px) 도망 중단
        if (distSq > 160000) {
            state.targetId = null;
            state.fleePos = null;
            return AnimalStates.IDLE;
        }

        // 2. 도망갈 목적지 계산 (위협 반대 방향으로 150px)
        // 매번 계산하지 않고 1초마다 또는 목적지 도달 시 갱신
        const now = Date.now();
        if (!state.fleePos || (state.lastFleeCalc && now - state.lastFleeCalc > 1000)) {
            const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
            state.fleePos = {
                x: transform.x + Math.cos(angle) * 150,
                y: transform.y + Math.sin(angle) * 150
            };
            state.lastFleeCalc = now;
        }

        // 3. A* 경로 탐색을 이용한 도망 (건물 등에 끼지 않도록)
        const speed = (entity.components.get('BaseStats')?.speed || 1.0) * 90; // 도망 시 가속
        Pathfinder.followPath(transform, state, state.fleePos, speed, this.system.engine);

        return null;
    }
}
