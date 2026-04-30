import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';

/**
 * 🌿 ForageState (초식동물 전용 수색/이동 상태)
 * 육식동물의 HUNT와 달리 차분하게 먹이(풀, 열매)를 향해 이동합니다.
 */
export default class ForageState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const mass = transform.mass || 50;
        
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
        if (distSq <= 25) {
            transform.vx = 0;
            transform.vy = 0;
            return AnimalStates.EAT;
        } else {
            const dist = Math.sqrt(distSq);
            // HUNT(25000)보다 훨씬 낮은 힘(8000)을 사용하여 여유롭게 이동
            const force = 8000; 
            transform.vx += (dx / dist) * force * dt / mass;
            transform.vy += (dy / dist) * force * dt / mass;
        }

        return null;
    }
}
