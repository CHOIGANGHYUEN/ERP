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

        for (const id of nearbyIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const targetAnim = entity.components.get('Animal');
            const targetRes = entity.components.get('Resource');
            const targetStats = entity.components.get('BaseStats');
            const tPos = entity.components.get('Transform');

            if (!tPos) continue;

            if ((diet === 'carnivore' || diet === 'omnivore') && targetAnim) {
                const distSq = this._evaluatePrey(myType, diet, targetAnim, targetStats, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }

            if ((diet === 'herbivore' || diet === 'omnivore') && targetRes && targetRes.edible) {
                const distSq = this._evaluatePlant(diet, targetRes, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
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