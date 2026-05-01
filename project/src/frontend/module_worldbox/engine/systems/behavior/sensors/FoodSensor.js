export default class FoodSensor {
    constructor(entityManager, spatialHash) {
        this.entityManager = entityManager;
        this.spatialHash = spatialHash;
    }

    findFood(animalOrStats, x, y, searchRadius) {
        let nearestId = null;
        const diet = animalOrStats.diet || 'herbivore';
        const myType = animalOrStats.type; // 자신의 종

        const radius = searchRadius || (diet === 'carnivore' ? 400 : 250);
        let minDistSq = radius * radius;

        const em = this.entityManager;
        const nearbyIds = this.spatialHash.query(x, y, radius);
        
        // 🚀 [Optimization] 검색 대상 수를 제한하여 밀집 지역에서의 CPU 폭주 방지
        const scanLimit = 20;
        let count = 0;

        for (const id of nearbyIds) {
            if (count++ > scanLimit) break;

            const entity = em.entities.get(id);
            if (!entity || id === animalOrStats.id) continue;

            const tPos = entity.components.get('Transform');
            if (!tPos) continue;


            const targetAnim = entity.components.get('Animal');
            const targetRes = entity.components.get('Resource');
            const targetStats = entity.components.get('BaseStats');

            if ((diet === 'carnivore' || diet === 'omnivore') && targetAnim) {
                const distSq = this._evaluatePrey(myType, diet, targetAnim, targetStats, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                    if (distSq < 225) break; // 🎯 [Early Exit]
                }
            }

            if ((diet === 'herbivore' || diet === 'omnivore') && targetRes && targetRes.edible) {
                const distSq = this._evaluatePlant(diet, targetRes, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                    if (distSq < 225) break; // 🎯 [Early Exit]
                }
            }
        }
        return nearestId;
    }

    _evaluatePrey(myType, diet, targetAnim, targetStats, tPos, x, y) {
        if (targetAnim.type === myType) return null;
        if (targetStats && targetStats.health <= 0) return null;
        if (diet === 'carnivore' && targetStats.diet === 'carnivore') return null;

        const dx = tPos.x - x;
        const dy = tPos.y - y;
        return dx * dx + dy * dy;
    }

    _evaluatePlant(diet, targetRes, tPos, x, y) {
        const dx = tPos.x - x;
        const dy = tPos.y - y;
        const distSq = dx * dx + dy * dy;
        const weight = (diet === 'omnivore') ? 1.2 : 1.0;
        return distSq / weight;
    }
}