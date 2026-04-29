import State from './State.js';

export default class FleeState extends State {
    update(entityId, entity, dt) {
        // TODO: 포식자 반대 방향으로 도망 로직. 일단은 임시 배회 처리
        return 'wander';
    }
}
