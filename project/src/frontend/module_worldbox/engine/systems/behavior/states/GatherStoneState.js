import GatherState from './GatherState.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * ⛏️ GatherStoneState
 * 인간이 돌이나 광물을 찾아 곡괭이로 캐고 수집하는 상태입니다.
 */
export default class GatherStoneState extends GatherState {
    update(entityId, entity, dt) {
        const state = entity.components.get('AIState');
        const inventory = entity.components.get('Inventory');
        const transform = entity.components.get('Transform');
        const em = this.system.entityManager;

        if (!state || !transform) return 'idle';

        // 인벤토리가 꽉 찼으면 복귀
        if (!inventory || inventory.getTotal() >= inventory.capacity) {
            state.targetId = null;
            state.isChopping = false;
            return 'idle';
        }

        // 1. 타겟 탐색 (중앙 관제에 요청)
        if (!state.targetId) {
            if (state.targetRequestFailed) {
                state.retryTimer = (state.retryTimer || 0) + dt;
                if (state.retryTimer >= 2.0) {
                    state.targetRequestFailed = false;
                    state.isTargetRequested = false;
                    state.retryTimer = 0;
                }
                if (transform) { transform.vx *= 0.5; transform.vy *= 0.5; }
                return null; 
            }

            if (!state.isTargetRequested) {
                const targetManager = this.system.engine.systemManager.targetManager;
                if (targetManager) {
                    const reqType = state.targetResourceType || 'stone';
                    targetManager.requestTarget(entityId, 'RESOURCE', { resourceType: reqType }, 'gather_stone');
                    state.isTargetRequested = true;
                }
            }
            
            if (transform) { transform.vx *= 0.5; transform.vy *= 0.5; }
            return null;
        }

        // 2. 이동 및 채집 (부모 클래스 위임)
        return this.executeMovementAndGathering(entityId, entity, dt, 400); // 사거리 20px
    }

    /**
     * 자원 획득 성공 시 시각 연출
     */
    onGatherSuccess(entity, amount, resourceNode) {
        if (amount > 0) {
            const state = entity.components.get('AIState');
            const targetId = state.targetId;
            const targetEnt = this.system.entityManager.entities.get(targetId);
            const tPos = targetEnt?.components.get('Transform');

            // 🔍 [Config-Driven Drops]
            const itemFactory = this.system.engine.factoryProvider.getFactory('item');
            if (itemFactory && tPos) {
                const config = this.system.engine.resourceConfig[resourceNode.id] || 
                               this.system.engine.resourceConfig[resourceNode.type] || {};
                const drops = config.drops || [{ type: 'stone', amount: 5 }];

                drops.forEach(drop => {
                    if (Math.random() <= (drop.chance || 1.0)) {
                        const amt = drop.amount || 1;
                        const vId = (entity.components.get('Civilization')?.villageId || -1);
                        const dropId = itemFactory.spawnDrop(tPos.x, tPos.y, drop.type, amt, vId);
                        if (dropId) state.lastHarvestedItemId = dropId;
                    }
                });
            }

            // ⛏️ 채광 파티클 (회색 파편)
            if (tPos && this.system.eventBus) {
                this.system.eventBus.emit('SPAWN_EFFECT_PARTICLES', {
                    x: tPos.x, y: tPos.y - 10, count: 4, type: 'EFFECT', color: '#9e9e9e', speed: 1.5
                });
            }
        }
    }
}
