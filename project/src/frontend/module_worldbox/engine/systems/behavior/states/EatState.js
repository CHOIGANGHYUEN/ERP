import State from './State.js';

export default class EatState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const metabolism = entity.components.get('Metabolism');

        const target = this.system.entityManager.entities.get(state.targetId);
        
        if (!target) {
            state.targetId = null;
            return 'wander'; // 타겟 소멸 시 배회로 복귀
        } 
        
        if (metabolism && metabolism.stomach >= metabolism.maxStomach * 0.95) {
            state.targetId = null;
            return 'wander'; // 배가 부르면 먹기 중단
        } 
        
        const tPos = target.components.get('Transform');
        if (tPos && ((tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2) > 100) {
            return 'hunt'; // 다른 동물에게 밀려나서 거리가 멀어지면 다시 다가감
        }

        return null;
    }
}
