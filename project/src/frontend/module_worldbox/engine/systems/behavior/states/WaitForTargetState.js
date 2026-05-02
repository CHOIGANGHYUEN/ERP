import State from './State.js';

/**
 * ⏳ WaitForTargetState
 * 중앙 관제(TargetManager)로부터 타겟을 할당받을 때까지 대기하는 상태입니다.
 * 타겟이 할당되면 AIState.targetId가 세팅되며, 원래의 상태로 돌아갑니다.
 */
export default class WaitForTargetState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');

        // 1. 타겟이 할당되었는지 확인
        if (state.targetId) {
            state.isTargetRequested = false;
            // 타겟이 생겼으므로 이전 상태(예: gather_wood, build 등)로 복귀
            return state.previousMode || 'idle';
        }

        // 2. 대기 연출 (제자리에서 두리번거리거나 가만히 있음)
        if (transform) {
            transform.vx *= 0.8;
            transform.vy *= 0.8;
        }

        // 3. 너무 오래 대기하면 포기하고 idle로 전환 (타임아웃)
        state.waitTimer = (state.waitTimer || 0) + dt;
        if (state.waitTimer > 5.0) {
            state.waitTimer = 0;
            state.isTargetRequested = false;
            return 'idle';
        }

        return null; // 타겟이 올 때까지 현재 상태 유지
    }

    enter(entityId, entity) {
        const state = entity.components.get('AIState');
        state.waitTimer = 0;
        // 현재 모드를 저장해뒀다가 타겟 할당 시 복귀
        if (state.mode !== 'wait_target') {
            state.previousMode = state.mode;
        }
    }
}
