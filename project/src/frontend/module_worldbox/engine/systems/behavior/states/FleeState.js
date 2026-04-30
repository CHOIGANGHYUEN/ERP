import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';

export default class FleeState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const mass = transform.mass || 50;

        const threat = this.system.entityManager.entities.get(state.targetId);
        
        // 1. 위협 대상이 사라지면 배회 상태로 복귀
        if (!threat) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        const tPos = threat.components.get('Transform');
        if (!tPos) return AnimalStates.IDLE;

        // 2. 반대 방향 벡터 계산 (도망)
        const dx = transform.x - tPos.x;
        const dy = transform.y - tPos.y;
        const distSq = dx * dx + dy * dy;

        // 3. 충분히 멀어지면(반경 400px) 도망 중단
        if (distSq > 160000) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        // 4. 질주 힘 적용
        const dist = Math.sqrt(distSq);
        const force = 30000; // 매우 빠른 속도로 도망
        transform.vx += (dx / dist) * force * dt / mass;
        transform.vy += (dy / dist) * force * dt / mass;

        return null;
    }
}
