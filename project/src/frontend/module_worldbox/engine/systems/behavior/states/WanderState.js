import State from './State.js';

export default class WanderState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const animal = entity.components.get('Animal');
        const metabolism = entity.components.get('Metabolism');

        // 배고프면 먹이 찾기
        if (metabolism && metabolism.stomach < metabolism.maxStomach * 0.5) {
            state.targetId = this.system.findFood(animal, transform.x, transform.y);
            if (state.targetId) {
                return 'hunt';
            }
        }

        // 방황(Wander) 패턴
        if (state.wanderAngle === undefined) state.wanderAngle = Math.random() * Math.PI * 2;

        // 가끔 부드럽게 방향 전환
        if (Math.random() < 0.05) {
            state.wanderAngle += (Math.random() - 0.5) * Math.PI;
        }

        const mass = transform.mass || 50;
        const force = 10000; // 마찰력을 극복하고 활기차게 배회하도록 힘 대폭 증가
        transform.vx += (Math.cos(state.wanderAngle) * force * dt) / mass;
        transform.vy += (Math.sin(state.wanderAngle) * force * dt) / mass;

        return null;
    }
}
