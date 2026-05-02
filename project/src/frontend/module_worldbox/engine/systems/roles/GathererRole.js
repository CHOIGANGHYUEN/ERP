import BaseRole from './BaseRole.js';
import { AnimalStates } from '../../components/behavior/State.js';

/**
 * 🧺 GathererRole
 * 채집가 직업. 가장 가까운 식물/열매를 찾아 채집(FORAGE) 상태로 전환합니다.
 */
export default class GathererRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        if (!state || !transform) return null;

        if (inventory && inventory.getTotal() >= inventory.capacity) return 'deposit';
        if (state.mode === AnimalStates.FORAGE && state.targetId) {
            if (this.em.entities.get(state.targetId)) return AnimalStates.FORAGE;
            state.targetId = null;
        }

        // FoodSensor를 재사용하여 식물 탐색
        const sensor = this.engine.systemManager?.humanBehavior?.foodSensor;
        const animal = entity.components.get('Animal');
        if (sensor && animal) {
            const foodId = sensor.findFood(animal, transform.x, transform.y, 400);
            if (foodId) {
                state.targetId = foodId;
                return AnimalStates.FORAGE;
            }
        }
        return null;
    }
}
