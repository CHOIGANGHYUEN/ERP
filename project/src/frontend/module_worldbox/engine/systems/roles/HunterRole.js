import BaseRole from './BaseRole.js';
import { AnimalStates } from '../../components/behavior/State.js';

/**
 * 🏹 HunterRole
 * 사냥꾼 직업. 가장 가까운 동물(양, 소 등)을 찾아 사냥합니다.
 */
export default class HunterRole extends BaseRole {
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
        if (!task) task = this.claimTask(entity, village, 'hunt');

        if (!task) {
            state.targetId = null;
            return null;
        }

        if (inventory && inventory.getTotal() >= inventory.capacity) return 'deposit';
        
        if (state.mode === AnimalStates.HUNT && state.targetId) {
            if (this.em.entities.get(state.targetId)) return AnimalStates.HUNT;
            state.targetId = null;
        }

        // 🥩 [Priority 1] 주변에 드롭된 고기(Meat/Food)가 있는지 먼저 확인
        const droppedMeatCondition = (ent) => {
            const item = ent.components.get('DroppedItem');
            if (!item || !['meat', 'food'].includes(item.itemType)) return false;
            if (item.claimedBy && item.claimedBy !== entity.id) return false;
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            return true;
        };

        const nearestDroppedId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 400, droppedMeatCondition, this.engine.spatialHash
        );

        if (nearestDroppedId !== null) {
            state.targetId = nearestDroppedId;
            const itemComp = this.em.entities.get(nearestDroppedId)?.components.get('DroppedItem');
            if (itemComp) itemComp.claimedBy = entity.id;
            return 'pickup';
        }

        // 🏹 [Priority 2] 사냥 가능한 동물 탐색 (양, 소)
        const PREY_TYPES = new Set(['sheep', 'cow']);
        const condition = (ent) => {
            if (ent === entity) return false;
            const a = ent.components.get('Animal');
            if (!a || !PREY_TYPES.has(a.type)) return false;
            if (a.claimedBy && a.claimedBy !== entity.id) return false;
            return true;
        };

        const nearestId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 1000, condition, this.engine.spatialHash
        );

        if (nearestId !== null) {
            state.targetId = nearestId;
            const targetEnt = this.em.entities.get(nearestId);
            const targetAnimal = targetEnt?.components.get('Animal');
            if (targetAnimal) targetAnimal.claimedBy = entity.id;

            return AnimalStates.HUNT;
        }
        return null;
    }
}
