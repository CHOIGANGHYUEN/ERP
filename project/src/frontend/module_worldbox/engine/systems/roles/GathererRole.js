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
        const civ = entity.components.get('Civilization');
        const vs = this.engine.systemManager?.villageSystem;
        if (!state || !transform || !civ || !vs) return null;

        const village = vs.getVillage(civ.villageId);
        if (!village) return null;

        // 📋 [Task System] 할일 목록에서 작업 수주 (줍기 우선)
        let task = this.claimTask(entity, village, 'pickup_food');
        if (!task) task = this.claimTask(entity, village, 'gather_food');

        if (!task) {
            state.targetId = null;
            return null;
        }

        // 1. 인벤토리가 꽉 찼으면 창고로 배달
        if (inventory && inventory.getTotal() >= inventory.capacity) return 'deposit';

        // 2. 이미 채집 중이면 상태 유지
        if (state.mode === 'gather_plant' && state.targetId) {
            if (this.em.entities.get(state.targetId)) return 'gather_plant';
            state.targetId = null;
        }

        // 🍎 [Priority 1] 주변에 드롭된 식량(Dropped Food/Fruit)이 있는지 먼저 확인
        const droppedFoodCondition = (ent) => {
            const item = ent.components.get('DroppedItem');
            if (!item || !['food', 'fruit', 'meat', 'berry'].includes(item.itemType)) return false;
            if (item.claimedBy && item.claimedBy !== entity.id) return false;
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            return true;
        };

        const nearestDroppedId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 400, droppedFoodCondition, this.engine.spatialHash
        );

        if (nearestDroppedId !== null) {
            state.targetId = nearestDroppedId;
            const itemComp = this.em.entities.get(nearestDroppedId)?.components.get('DroppedItem');
            if (itemComp) itemComp.claimedBy = entity.id;
            return 'pickup';
        }

        // 🧺 [Priority 2] 주변 식물 탐색
        const plantCondition = (ent) => {
            const res = ent.components.get('Resource');
            if (!res || !res.edible || res.value <= 0) return false;
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            if (res.claimedBy && res.claimedBy !== entity.id) return false;
            return true;
        };

        const nearestPlantId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 1000, plantCondition, this.engine.spatialHash
        );

        if (nearestPlantId !== null) {
            state.targetId = nearestPlantId;
            const targetEnt = this.em.entities.get(nearestPlantId);
            const targetRes = targetEnt.components.get('Resource');
            if (targetRes) targetRes.claimedBy = entity.id; 
            return 'gather_plant';
        }

        return null;
    }
}
