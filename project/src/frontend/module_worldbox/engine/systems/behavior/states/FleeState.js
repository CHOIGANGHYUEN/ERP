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
        // 🚀 [Expert Optimization] 도망 중에는 더 기민하게 반응하도록 갱신 주기 단축 (1000ms -> 300ms)
        const now = Date.now();
        if (!state.fleePos || (state.lastFleeCalc && now - state.lastFleeCalc > 300)) {
            const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
            state.fleePos = {
                x: transform.x + Math.cos(angle) * 150,
                y: transform.y + Math.sin(angle) * 150
            };
            state.lastFleeCalc = now;
        }

        // 3. A* 경로 탐색을 이용한 도망 (건물 등에 끼지 않도록)
        const stats = entity.components.get('BaseStats');
        const slowMult = stats?.injurySlowMultiplier || 1.0;
        const speed = (stats?.speed || 45) * 1.8 * slowMult; 
        // 🚀 [Expert Optimization] 도망 중에는 경로를 400ms마다 재계산하여 포식자 위치 변화에 기민하게 대응
        const result = Pathfinder.followPath(transform, state, state.fleePos, speed, this.system.engine, 8, 400);

        if (result === -1) {
            state.failedPathCount = (state.failedPathCount || 0) + 1;
            if (state.failedPathCount >= 3) {
                // 도망갈 길이 없으면 잠시 이 위협을 무시하고 다른 행동 유도 (포위 탈출 시도 등)
                state.blacklist.set(state.targetId, Date.now() + 10000); 
                state.targetId = null;
                state.fleePos = null;
                state.failedPathCount = 0;
            }
            return AnimalStates.IDLE;
        } else if (result === true) {
            state.failedPathCount = 0;
        }

        return null;
    }
}
