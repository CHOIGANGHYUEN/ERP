import State from './State.js';

export default class HuntState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const mass = transform.mass || 50;
        
        const target = this.system.entityManager.entities.get(state.targetId);
        if (!target) {
            state.targetId = null;
            return 'wander'; // 타겟이 사라지면 다시 배회
        }

        const tPos = target.components.get('Transform');
        if (!tPos) {
            state.targetId = null;
            return 'wander';
        }

        const dx = tPos.x - transform.x;
        const dy = tPos.y - transform.y;
        const distSq = dx * dx + dy * dy;

        // 얼굴을 파묻고 먹는 초근접 사거리(25 = 반경 5픽셀)로 최적화
        if (distSq <= 25) {
            transform.vx = 0;
            transform.vy = 0;
            return 'eat';
        } else {
            const dist = Math.sqrt(distSq);
            const force = 25000; // 타겟을 향해 전력 질주하도록 추진력 강화
            transform.vx += (dx / dist) * force * dt / mass;
            transform.vy += (dy / dist) * force * dt / mass;
        }

        return null;
    }
}
