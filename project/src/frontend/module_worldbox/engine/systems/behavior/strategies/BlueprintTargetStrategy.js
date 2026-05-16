import TargetStrategy from './TargetStrategy.js';

/**
 * 🏗️ BlueprintTargetStrategy
 * 건설 중인 건물 청사진(Blueprint)을 탐색하는 전략입니다.
 */
export default class BlueprintTargetStrategy extends TargetStrategy {
    execute(manager, entity, transform, criteria, intent, forceGlobal = false) {
        const x = transform.x;
        const y = transform.y;
        const SEARCH_RADIUS = forceGlobal ? 2000 : 800;

        const aiState = entity.components.get('AIState');
        if (aiState) aiState.searchRange = SEARCH_RADIUS;

        const zone = forceGlobal ? null : this.getZone(manager, entity, intent);
        const spatialHash = manager.engine.spatialHash;
        const em = manager.entityManager;

        return em.findNearestEntityWithComponent(x, y, SEARCH_RADIUS, (ent) => {
            const struc = ent.components.get('Structure');
            const entT = ent.components.get('Transform');
            if (!struc || !struc.isBlueprint || struc.isComplete) return false;
            if (entT && !this.isInZone(manager, entT.x, entT.y, zone)) return false;

            // 본인 마을 소속 청사진만
            const civ = ent.components.get('Civilization');
            const reqCiv = entity.components.get('Civilization');
            return civ && reqCiv && civ.villageId === reqCiv.villageId;
        }, spatialHash, 2); // 🏗️ Layer 2 (Obstacle/Building) 명시적 지정
    }
}
