import State from './State.js';

/**
  * 🫳 GrabbedState
  * 플레이어가 마우스로 개체를 잡았을 때 진입하는 상태입니다.
  * 모든 AI 행동이 일시 정지되며, 물리 엔진의 영향을 받지 않습니다.
  */
export default class GrabbedState extends State {
    constructor(system) {
        super(system);
        this.mode = 'grabbed';
    }

    update(entityId, entity, dt) {
        // 잡힌 상태에서는 스스로 이동하거나 판단하지 않음
        // 위치 업데이트는 InputSystem에서 직접 Transform을 제어함
        const transform = entity.components.get('Transform');
        if (transform) {
            transform.vx = 0;
            transform.vy = 0;
        }
        return null;
    }
}
