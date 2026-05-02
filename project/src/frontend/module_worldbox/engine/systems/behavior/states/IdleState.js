import State from './State.js';

export default class IdleState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        
        if (!state || !transform) return null;

        // 물리 마찰력 적용 (멈추기)
        transform.vx *= 0.8;
        transform.vy *= 0.8;

        // 대기 타이머 처리 (3초마다 한 번씩 이동 시도)
        if (state.idleWaitTimer === undefined) {
            state.idleWaitTimer = 3.0; 
        }

        state.idleWaitTimer -= dt;
        if (state.idleWaitTimer <= 0) {
            state.idleWaitTimer = undefined;
            return 'wander'; // 정식 배회 상태로 전환 (Pathfinder 사용)
        }
        
        return null;
    }
}