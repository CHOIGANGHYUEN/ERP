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

        const tPos = target.components.get('Transform');
        if (!tPos) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 초근접 사거리 도달 시 식사 상태로 전환
        if (distSq <= 100) {
            transform.vx *= 0.5;
            transform.vy *= 0.5;
            return AnimalStates.EAT;
        } else {
            // 🚀 [Troubleshooting 3] 초식동물도 장애물(건물)을 피해 먹이를 찾도록 A* 적용
            const speed = (entity.components.get('BaseStats')?.speed || 0.8) * 50; 
            Pathfinder.followPath(transform, state, tPos, speed, this.system.engine);
        }

        return null;
    }
}
