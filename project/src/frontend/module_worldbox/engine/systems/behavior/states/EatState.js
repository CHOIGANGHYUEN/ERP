import State from './State.js';
import { AnimalStates } from '../../../components/behavior/State.js';

export default class EatState extends State {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const stats = entity.components.get('BaseStats');

        const target = this.system.entityManager.entities.get(state.targetId);
        
        // 1. 타겟 소멸 시 배회로 복귀
        if (!target) {
            state.targetId = null;
            return AnimalStates.IDLE; 
        } 
        
        // 2. 사거리 체크 (너무 멀어지면 다시 추적)
        const tPos = target.components.get('Transform');
        if (tPos) {
            const distSq = (tPos.x - transform.x) ** 2 + (tPos.y - transform.y) ** 2;
            if (distSq > 100) return AnimalStates.HUNT;
        }

        // 3. 실제 먹기 동작 (식성에 따른 분기)
        if (stats) {
            const targetAnim = target.components.get('Animal');
            const targetRes = target.components.get('Resource');

            // 타겟이 동물인 경우 (육식/잡식)
            if (targetAnim && (stats.diet === 'carnivore' || stats.diet === 'omnivore')) {
                this.system.attackAndConsumeAnimal(entity, target);
            } 
            // 타겟이 식물인 경우 (초식/잡식)
            else if (targetRes && targetRes.edible && (stats.diet === 'herbivore' || stats.diet === 'omnivore')) {
                this.system.consumePlant(entity, target);
            }

            // 허기 점진적 회복
            stats.hunger = Math.min(stats.maxHunger, stats.hunger + dt * 20);
        }


        // 4. 포만감이 충분하면 종료
        if (stats && stats.hunger >= stats.maxHunger * 0.95) {
            state.targetId = null;
            return AnimalStates.IDLE;
        }

        return null;
    }

}

