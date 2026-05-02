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
        let nearestId = null;
        let minDSq = Infinity;
        for (const id of this.em.animalIds) {
            const e = this.em.entities.get(id);
            if (!e || e === entity) continue;
            const a = e.components.get('Animal');
            if (!a || !PREY_TYPES.has(a.type)) continue;
            const t = e.components.get('Transform');
            if (!t) continue;
            const dSq = (t.x - transform.x) ** 2 + (t.y - transform.y) ** 2;
            if (dSq < minDSq && dSq < 400 * 400) { minDSq = dSq; nearestId = id; }
        }

        if (nearestId) {
            state.targetId = nearestId;
            return AnimalStates.HUNT;
        }
        return null;
    }
}
