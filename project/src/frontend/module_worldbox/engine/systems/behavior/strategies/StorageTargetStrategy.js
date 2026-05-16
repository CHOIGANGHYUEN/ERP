import TargetStrategy from './TargetStrategy.js';
import ResourceRegistry from '../../../data/ResourceRegistry.js';

/**
 * 📦 StorageTargetStrategy
 * 마을 창고(Storage)를 탐색하는 전략입니다. 입고(Deposit)와 출고(Withdraw)를 모두 처리합니다.
 */
export default class StorageTargetStrategy extends TargetStrategy {
    execute(manager, entity, transform, criteria, intent, forceGlobal = false) {
        const type = (criteria?.resourceType || '').toLowerCase();
        const targetType = criteria?.targetType || managerTargetType(manager, intent);
        const isDeposit = targetType !== 'STORAGE_WITHDRAW';
        
        const x = transform.x;
        const y = transform.y;
        const SEARCH_RADIUS = 2000;
        const spatialHash = manager.engine.spatialHash;
        const em = manager.entityManager;
        const civ = entity.components.get('Civilization');
        const logistics = manager.engine.systemManager?.villageSystem?.logisticsMediator;

        if (logistics && civ?.villageId !== undefined && civ.villageId !== -1) {
            const id = isDeposit
                ? logistics.findStorageForDeposit(civ.villageId, type || 'wood', 1, transform)
                : logistics.findStorageForWithdraw(civ.villageId, type || 'wood', 1, transform);
            if (id !== null && id !== undefined) return id;
        }

        let minDistSq = SEARCH_RADIUS * SEARCH_RADIUS;
        let bestId = null;

        if (spatialHash) {
            spatialHash.eachInSpiral(x, y, SEARCH_RADIUS, (id) => {
                const ent = em.entities.get(id);
                if (!ent) return false;

                const storageComp = ent.components.get('Storage');
                if (!storageComp) return false;

                const structureComp = ent.components.get('Structure');
                const civComp = ent.components.get('Civilization');
                const reqCiv = entity.components.get('Civilization');

                // 🏗️ [Strict Validation] 완공된 아군 마을 창고만 대상
                const isComplete = !structureComp || structureComp.isComplete;
                const isSameVillage = civComp && reqCiv && civComp.villageId === reqCiv.villageId;

                if (!isComplete || !isSameVillage) return false;

                const entT = ent.components.get('Transform');
                if (!entT) return false;

                const aiState = entity.components.get('AIState');
                if (aiState && aiState.isBlacklisted && aiState.isBlacklisted(id)) return false;

                const dx = entT.x - x;
                const dy = entT.y - y;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistSq) {
                    if (isDeposit) {
                        // 입고: 창고가 꽉 차지 않았는지 확인
                        if (!storageComp.isFull) {
                            minDistSq = distSq;
                            bestId = id;
                            return true;
                        }
                    } else {
                        // 출고: 해당 자원이 있는지 확인 (ResourceRegistry 활용)
                        let hasResource = false;
                        for (const storeItemType of Object.keys(storageComp.items)) {
                            if (ResourceRegistry.isMatch(storeItemType, type)) {
                                if ((storageComp.items[storeItemType] || 0) >= 1) {
                                    hasResource = true;
                                    break;
                                }
                            }
                        }
                        
                        if (hasResource) {
                            minDistSq = distSq;
                            bestId = id;
                            return true;
                        }
                    }
                }
                return false;
            });
        }
        return bestId;
    }
}

function managerTargetType(manager, intent) {
    if (intent === 'deposit') return 'STORAGE_DEPOSIT';
    if (intent === 'withdraw' || intent === 'build') return 'STORAGE_WITHDRAW';
    return 'STORAGE_DEPOSIT';
}
