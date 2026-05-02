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
        if (!state || !transform) return null;

        if (inventory && inventory.getTotal() >= inventory.capacity) return 'deposit';
        if (state.mode === AnimalStates.HUNT && state.targetId) {
            if (this.em.entities.get(state.targetId)) return AnimalStates.HUNT;
            state.targetId = null;
        }

        // 사냥 가능한 동물 탐색 (양, 소)
        const PREY_TYPES = new Set(['sheep', 'cow']);
        const condition = (ent) => {
            if (ent === entity) return false;
            const a = ent.components.get('Animal');
            if (!a || !PREY_TYPES.has(a.type)) return false;

            // 🔒 사냥감 독점 확인 (다른 사냥꾼이 쫓고 있는지)
            if (a.claimedBy && a.claimedBy !== entity.id) {
                const claimer = this.em.entities.get(a.claimedBy);
                if (claimer) {
                    const claimerState = claimer.components.get('AIState');
                    if (claimerState && claimerState.targetId === ent.id) return false;
                }
                a.claimedBy = null;
            }
            return true;
        };

        const nearestId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 400, condition, this.engine.spatialHash
        );

        if (nearestId !== null) {
            state.targetId = nearestId;
            // 🔒 사냥감 독점권 설정
            const targetEnt = this.em.entities.get(nearestId);
            const targetAnimal = targetEnt?.components.get('Animal');
            if (targetAnimal) targetAnimal.claimedBy = entity.id;

            return AnimalStates.HUNT;
        }
        return null;
    }
}
