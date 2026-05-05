import BaseRole from './BaseRole.js';

/**
 * 🏗️ ArchitectRole
 * 건축가 직업. 마을에 건설 과업이 있으면 해당 청사진으로 이동하여 건설합니다.
 */
export default class ArchitectRole extends BaseRole {
    decide(entity, dt) {
        const state = entity.components.get('AIState');
        const civ = entity.components.get('Civilization');
        const inventory = entity.components.get('Inventory');
        const vs = this.engine.systemManager?.villageSystem;
        if (!state || !civ || !vs) return null;

        const village = vs.getVillage(civ.villageId);
        if (!village) return null;

        // 📋 [Task System] 할일 목록에서 건축 작업 수주
        const task = this.claimTask(entity, village, 'build');
        let targetId = task ? task.targetId : null;

        // 1. 과업이 없으면 IDLE (또는 다른 일 탐색)
        if (!targetId) {
            state.targetId = null;
            return null;
        }

        if (state.unreachableTargets && state.unreachableTargets.has(targetId)) {
            this.releaseTask(entity, village, task.id, false); // 도달 불가 시 과업 포기
            return null;
        }

        // 2. 🪵 [Resource Guard] 해당 건물이 요구하는 자원이 있는지 확인
        const blueprint = this.em.entities.get(targetId);
        const structure = blueprint?.components.get('Structure');

        // 작업 완료 체크 (누군가 이미 다 지었을 때)
        if (!structure || structure.isComplete) {
            this.releaseTask(entity, village, task.id, true);
            state.targetId = null;
            return null;
        }

        // 건물의 종류 및 진행도에 따른 필요 자원 파악
        let requiredType = 'wood';
        const type = structure.type;
        const prog = structure.progress || 0;

        if (type === 'house') {
            if (prog > 50) requiredType = 'stone';
        } else if (type === 'well' || type === 'temple' || type === 'watchtower') {
            requiredType = 'stone';
        } else if (type === 'blacksmith') {
            requiredType = prog > 40 ? 'iron_ore' : 'stone';
        } else if (type === 'warehouse' || type === 'storage') {
            requiredType = 'wood';
        }

        const requiredAmount = 1;

        // 🏷️ [Unified Match] 인벤토리에 필요한 자원(또는 유사 속성 자원)이 있는지 확인
        const hasResource = inventory && inventory.has(requiredType, requiredAmount);

        // 3. 자원이 꽉 찼는데 필요한 자원이 아니라면 창고에 비우러 가야 함
        if (inventory && inventory.getTotal() >= inventory.capacity && !hasResource) {
            return 'deposit';
        }

        // 자원이 없으면 수집 시도
        if (!hasResource) {
            // 🔓 [Blacklist Clear] 건설을 중단하고 자원을 구하러 가는 시점이므로 블랙리스트 초기화
            if (state.unreachableTargets) state.unreachableTargets.clear();

            const transform = entity.components.get('Transform');

            // 🪨 [Priority 1] 아주 가까운(300px) 곳에 드롭 아이템이 있다면 즉시 줍기
            const droppedCondition = (ent) => {
                const item = ent.components.get('DroppedItem');
                if (!item) return false;

                const req = requiredType.toLowerCase();
                const iCat = (item.category || '').toLowerCase();

                // 🎯 [Exact Type Match] 사용자의 요구대로 아이템의 속성(Type/Category)이 정확히 일치하는지만 확인
                const isMatch = (iCat === req);

                if (isMatch) {
                    // 🏘️ [Ownership] 자국 아이템이거나 무소속 아이템만 수집
                    if (item.villageId !== -1 && item.villageId !== civ.villageId) return false;
                    
                    if (item.claimedBy && item.claimedBy !== entity.id) return false;
                    if (state.unreachableTargets && state.unreachableTargets.has(ent.id)) return false;
                    return true;
                }
                return false;
            };

            const veryNearDroppedId = this.em.findNearestEntityWithComponent(
                transform.x, transform.y, 300, droppedCondition, this.engine.spatialHash
            );

            if (veryNearDroppedId !== null) {
                state.targetId = veryNearDroppedId;
                const itemComp = this.em.entities.get(veryNearDroppedId)?.components.get('DroppedItem');
                if (itemComp) itemComp.claimedBy = entity.id;
                return 'pickup';
            }

            // 🏠 [Priority 2] 마을 창고(Storage)에 재료가 있는지 확인 (완공된 건물만)
            const storage = Array.from(this.em.buildingIds)
                .map(id => this.em.entities.get(id))
                .find(storeEnt => {
                    const civComp = storeEnt?.components.get('Civilization');
                    const structComp = storeEnt?.components.get('Structure');

                    if (civComp?.villageId !== civ.villageId) return false;
                    if (structComp && !structComp.isComplete) return false;

                    const storeComp = storeEnt.components.get('Storage');
                    if (!storeComp) return false;

                    // 🏷️ [Unified Match] 창고에 직접적인 ID 또는 유사 속성 자원이 있는지 확인
                    const lowerReq = requiredType.toLowerCase();
                    let found = false;
                    for (const id of Object.keys(storeComp.items)) {
                        if (id.toLowerCase().includes(lowerReq)) {
                            found = true;
                            break;
                        }
                    }
                    return found;
                });

            if (storage) {
                state.targetId = storage.id;
                state.targetResourceType = requiredType;
                return 'withdraw';
            }

            // 🪨 [Priority 3] 창고에도 없다면 맵 전체 범위(2400px)까지 드롭 아이템 탐색
            const nearestDroppedId = this.em.findNearestEntityWithComponent(
                transform.x, transform.y, 2400, droppedCondition, this.engine.spatialHash
            );

            if (nearestDroppedId !== null) {
                state.targetId = nearestDroppedId;
                const itemComp = this.em.entities.get(nearestDroppedId)?.components.get('DroppedItem');
                if (itemComp) itemComp.claimedBy = entity.id;
                return 'pickup';
            }

            // 🧺 [Priority 4] 드롭된 게 없으면 직접 수집(벌목/채광 등) 시도
            state.targetId = null;
            state.targetResourceType = requiredType;

            // 🪨 돌이나 철광석은 내구도가 있으므로 gather_wood(채광/벌목 로직)를 사용하고,
            // 🌿 풀이나 베리류는 단발성인 gather_plant를 사용합니다.
            const isHeavy = requiredType === 'stone' || requiredType === 'iron_ore' || requiredType === 'wood';
            return isHeavy ? 'gather_wood' : 'gather_plant';
        }

        state.targetId = targetId;
        return 'build';
    }
}
