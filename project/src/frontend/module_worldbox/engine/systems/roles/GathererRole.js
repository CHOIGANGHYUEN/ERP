import BaseRole from './BaseRole.js';
import { AnimalStates } from '../../components/behavior/State.js';

/**
 * 🧺 GathererRole
 * 채집가 직업. 마을 자원을 확보하기 위해 주변 식물/열매를 수집(GATHER_PLANT)합니다.
 * (FORAGE는 개인의 허기를 채우기 위한 수색 상태로 남겨둡니다.)
 */
export default class GathererRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        if (!state || !transform) return null;

        // 1. 인벤토리가 꽉 찼으면 창고로 배달
        if (inventory && inventory.getTotal() >= inventory.capacity) return 'deposit';

        // 2. 이미 채집 중이면 상태 유지
        if (state.mode === 'gather_plant' && state.targetId) {
            if (this.em.entities.get(state.targetId)) return 'gather_plant';
            state.targetId = null;
        }

        // 3. 주변 식물 탐색 (FoodSensor 재사용하되, 상태는 gather_plant 로)
        const sensor = this.engine.systemManager?.humanBehavior?.foodSensor;
        const animal = entity.components.get('Animal');
        if (sensor && animal) {
            // 채집가는 더 넓은 반경(500px)에서 식물을 찾습니다.
            const plantId = sensor.findFood(animal, transform.x, transform.y, 500);
            if (plantId) {
                state.targetId = plantId;
                return 'gather_plant';
            }
        }

        return null;
    }
}
