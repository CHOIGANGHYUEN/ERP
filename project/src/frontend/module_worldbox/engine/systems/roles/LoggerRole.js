import BaseRole from './BaseRole.js';

/**
 * 🪓 LoggerRole
 * 벌목꾼 직업. 가장 가까운 나무를 찾아 채집(GatherWoodState)으로 전환합니다.
 */
export default class LoggerRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        if (!state || !transform) return null;

        // 인벤토리가 꽉 찼으면 창고에 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 이미 나무를 향해 이동 중이면 유지
        if (state.mode === 'gather_wood' && state.targetId) {
            const tgt = this.em.entities.get(state.targetId);
            if (tgt) return 'gather_wood';
            state.targetId = null;
        }

        // 가장 가까운 나무 탐색
        let nearestId = null;
        let minDistSq = Infinity;
        for (const id of this.em.resourceIds) {
            const res = this.em.entities.get(id);
            if (!res) continue;
            const visual = res.components.get('Visual');
            if (visual?.type !== 'tree') continue;
            const resource = res.components.get('Resource');
            if (!resource || resource.amount <= 0) continue;

            const t = res.components.get('Transform');
            if (!t) continue;
            const dx = t.x - transform.x;
            const dy = t.y - transform.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < minDistSq) { minDistSq = dSq; nearestId = id; }
        }

        if (nearestId) {
            state.targetId = nearestId;
            return 'gather_wood';
        }

        return null;
    }
}
