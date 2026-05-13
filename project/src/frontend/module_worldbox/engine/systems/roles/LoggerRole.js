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
        const civ = entity.components.get('Civilization');
        const vs = this.engine.systemManager?.villageSystem;
        if (!state || !transform || !civ || !vs) return null;

        const village = vs.getVillage(civ.villageId);
        if (!village) return null;

        // 📋 [Task System] 할일 목록에서 작업 수주 (줍기 우선)
        let task = this.claimTask(entity, village, 'pickup_wood');
        if (!task) task = this.claimTask(entity, village, 'gather_wood');

        if (!task) {
            state.targetId = null;
            return null;
        }

        // 인벤토리가 꽉 찼으면 창고에 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 이미 유효한 나무 타겟이 있으면 유지
        if (state.mode === 'gather_wood' && state.targetId) {
            const tgt = this.em.entities.get(state.targetId);
            if (tgt) return 'gather_wood';
            state.targetId = null;
        }

        // 🪨 [Priority 1] 주변에 드롭된 나무(Dropped Wood)가 있는지 먼저 확인
        const droppedWoodCondition = (ent) => {
            const item = ent.components.get('DroppedItem');
            if (!item) return false;
            
            const iType = (item.itemType || '').toLowerCase();
            const iCat = (item.category || '').toLowerCase();

            // 🏷️ [Unified Match] wood, log, stick 등 목재 계열 모두 수용
            const isWood = (iCat === 'wood' || iType.includes('wood') || iType.includes('log') || iType.includes('stick'));
            if (!isWood) return false;

            // 🏘️ [Ownership] 자국 아이템이거나 무소속 아이템만 수집
            if (item.villageId !== -1 && item.villageId !== civ.villageId) return false;

            if (item.claimedBy && item.claimedBy !== entity.id) return false;
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            return true;
        };

        const nearestDroppedWoodId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 400, droppedWoodCondition, this.engine.spatialHash, 1 // Layer 1: Static/Nature
        );

        if (nearestDroppedWoodId !== null) {
            state.targetId = nearestDroppedWoodId;
            const itemComp = this.em.entities.get(nearestDroppedWoodId)?.components.get('DroppedItem');
            if (itemComp) itemComp.claimedBy = entity.id;
            return 'pickup'; // Dropped Item을 줍는 상태로 전환
        }

        // 🪓 [Priority 2] 가장 가까운 나무 탐색 (마을 할일이 있을 때만 탐색 수행)
        const treeCondition = (ent) => {
            const resource = ent.components.get('Resource');
            if (!resource || resource.value <= 0) return false;
            
            const rType = (resource.type || '').toLowerCase();
            const rCat = (resource.category || '').toLowerCase();

            // 🌳 [Unified Match] 카테고리가 tree이거나 이름에 tree가 포함된 경우 모두 인정
            const isTree = (rCat === 'tree' || rType.includes('tree') || resource.isTree);
            if (!isTree) return false;
            
            const visual = ent.components.get('Visual');
            if (resource.value < 20 || (visual && visual.size < 10)) return false;
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            if (resource.claimedBy && resource.claimedBy !== entity.id) return false;
            return true;
        };

        const nearestTreeId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 1000, treeCondition, this.engine.spatialHash, 1 // Layer 1: Static/Nature
        );

        if (nearestTreeId !== null) {
            state.targetId = nearestTreeId;
            const targetEnt = this.em.entities.get(nearestTreeId);
            const targetRes = targetEnt?.components.get('Resource');
            if (targetRes) targetRes.claimedBy = entity.id;
            return 'gather_wood';
        }

        return null;
    }
}
