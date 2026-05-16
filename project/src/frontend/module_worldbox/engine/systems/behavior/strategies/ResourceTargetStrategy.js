import TargetStrategy from './TargetStrategy.js';
import ResourceRegistry from '../../../data/ResourceRegistry.js';

/**
 * 🌲 ResourceTargetStrategy
 * 자연 자원(Resource) 및 드롭된 아이템(DroppedItem)을 탐색하는 전략입니다.
 */
export default class ResourceTargetStrategy extends TargetStrategy {
    execute(manager, entity, transform, criteria, intent, forceGlobal = false) {
        const type = (criteria?.resourceType || '').toLowerCase();
        const x = transform.x;
        const y = transform.y;
        const MAX_RADIUS = 1200;

        const aiState = entity.components.get('AIState');
        if (aiState) aiState.searchRange = MAX_RADIUS;

        const zone = forceGlobal ? null : this.getZone(manager, entity, intent);
        const spatialHash = manager.engine.spatialHash;
        const em = manager.entityManager;

        // 🚀 [Tiered Search] 근거리부터 원거리로 점진적 확장
        const searchSteps = forceGlobal ? [MAX_RADIUS] : [300, 600, MAX_RADIUS];

        for (const radius of searchSteps) {
            let minDistSq = radius * radius;
            let bestId = null;

            if (spatialHash) {
                spatialHash.eachInSpiral(x, y, radius, (id) => {
                    const ent = em.entities.get(id);
                    if (!ent) return false;

                    const entT = ent.components.get('Transform');
                    if (!entT || !this.isInZone(manager, entT.x, entT.y, zone)) return false;

                    const res = ent.components.get('Resource');
                    const drop = ent.components.get('DroppedItem');

                    let isMatch = false;

                    if (res) {
                        // 🏷️ [ResourceRegistry] 자원 타입 및 카테고리 교차 검사
                        isMatch = ResourceRegistry.isMatch(res.type || '', type) || 
                                  ResourceRegistry.isMatch(res.category || '', type);

                        if (!isMatch) return false;
                        if (res.value <= 0 || res.isFalling) return false;
                        if (res.claimedBy && res.claimedBy !== entity.id) return false;
                    } else if (drop) {
                        // 🏷️ [ResourceRegistry] 드롭 아이템 매칭
                        isMatch = ResourceRegistry.isMatch(drop.itemType || '', type) || 
                                  ResourceRegistry.isMatch(drop.category || '', type);

                        if (!isMatch) return false;

                        const reqCiv = entity.components.get('Civilization');
                        const isOwner = drop.villageId === -1 || (reqCiv && drop.villageId === reqCiv.villageId);
                        if (!isOwner || (drop.claimedBy && drop.claimedBy !== entity.id)) return false;
                    } else {
                        return false;
                    }

                    if (aiState && aiState.isBlacklisted && aiState.isBlacklisted(id)) return false;

                    const dx = entT.x - x;
                    const dy = entT.y - y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        bestId = id;
                        return true; // 최적의 자원 발견 시 즉시 종료
                    }
                    return false;
                });
            }

            if (bestId !== null) return bestId;
        }

        return null;
    }
}
