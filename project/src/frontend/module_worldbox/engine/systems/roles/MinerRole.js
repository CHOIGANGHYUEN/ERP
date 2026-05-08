import BaseRole from './BaseRole.js';

/**
 * ⛏️ MinerRole
 * 광부 직업. 가장 가까운 석재나 광석을 찾아 채집(GatherWoodState - 범용 채집 상태)으로 전환합니다.
 */
export default class MinerRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const transform = entity.components.get('Transform');
        const inventory = entity.components.get('Inventory');
        const civ = entity.components.get('Civilization');
        const vs = this.engine.systemManager?.villageSystem;
        if (!state || !transform || !civ || !vs) return null;

        const village = vs.getVillage(civ.villageId);
        if (!village) return null;

        // 📋 [Task System] 할일 목록에서 작업 수주
        let task = this.claimTask(entity, village, 'pickup_stone');
        if (!task) task = this.claimTask(entity, village, 'gather_stone');

        if (!task) {
            state.targetId = null;
            return null;
        }
        state.targetResourceType = 'stone';

        // 인벤토리가 꽉 찼으면 창고에 보관
        if (inventory && inventory.getTotal() >= inventory.capacity) {
            return 'deposit';
        }

        // 이미 유효한 광석 타겟이 있으면 유지
        if (state.mode === 'gather_stone' && state.targetId) {
            const tgt = this.em.entities.get(state.targetId);
            if (tgt) return 'gather_stone';
            state.targetId = null;
        }

        // 🪨 [Priority 1] 주변에 드롭된 석재(Dropped Stone/Ore) 확인
        const droppedStoneCondition = (ent) => {
            const item = ent.components.get('DroppedItem');
            if (!item) return false;
            
            const iType = (item.itemType || '').toLowerCase();
            const iCat = (item.category || '').toLowerCase();

            const isStone = (iCat === 'mineral' || iType.includes('stone') || iType.includes('ore') || iType.includes('rock'));
            if (!isStone) return false;

            if (item.villageId !== -1 && item.villageId !== civ.villageId) return false;
            if (item.claimedBy && item.claimedBy !== entity.id) return false;
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            return true;
        };

        const nearestDroppedId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 400, droppedStoneCondition, this.engine.spatialHash
        );

        if (nearestDroppedId !== null) {
            state.targetId = nearestDroppedId;
            const itemComp = this.em.entities.get(nearestDroppedId)?.components.get('DroppedItem');
            if (itemComp) itemComp.claimedBy = entity.id;
            return 'pickup';
        }

        // ⛏️ [Priority 2] 가장 가까운 석재/광석 탐색
        const stoneCondition = (ent) => {
            const resource = ent.components.get('Resource');
            if (!resource || resource.value <= 0) return false;
            
            const rType = (resource.type || '').toLowerCase();
            const rCat = (resource.category || '').toLowerCase();

            const isStone = (rCat === 'mineral' || rCat === 'stone' || rType.includes('stone') || rType.includes('ore') || resource.isMineral);
            if (!isStone) return false;
            
            if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
            if (resource.claimedBy && resource.claimedBy !== entity.id) return false;
            return true;
        };

        const nearestStoneId = this.em.findNearestEntityWithComponent(
            transform.x, transform.y, 1000, stoneCondition, this.engine.spatialHash
        );

        if (nearestStoneId !== null) {
            state.targetId = nearestStoneId;
            const targetEnt = this.em.entities.get(nearestStoneId);
            const targetRes = targetEnt?.components.get('Resource');
            if (targetRes) targetRes.claimedBy = entity.id;
            return 'job_miner';
        }

        return 'job_miner'; // 기본적으로 MinerState에 위임하여 타겟 요청 수행
    }
}
