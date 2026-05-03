export default class FoodSensor {
    constructor(entityManager, spatialHash) {
        this.entityManager = entityManager;
        this.spatialHash = spatialHash;
    }

    findFood(animalOrStats, x, y, searchRadius, state = null) {
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

            if (state && state.blacklist && state.blacklist.has(id)) {
                if (Date.now() < state.blacklist.get(id)) continue;
                else state.blacklist.delete(id);
            }

            const entity = em.entities.get(id);
            if (!entity || id === animalOrStats.id) continue;

            const tPos = entity.components.get('Transform');
            if (!tPos) continue;

            // 📦 [New] 드랍된 아이템 감지
            const droppedItem = entity.components.get('DroppedItem');
            if (droppedItem) {
                const isEdible = this._checkItemEdibility(diet, droppedItem.itemType);
                if (isEdible) {
                    const dx = tPos.x - x;
                    const dy = tPos.y - y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        nearestId = id;
                        if (distSq < 100) break;
                    }
                }
                continue;
            }

            const targetAnim = entity.components.get('Animal');
            const targetRes = entity.components.get('Resource');
            const targetStats = entity.components.get('BaseStats');

            // 🐆 육식/잡식: 살아있는 먹잇감 (사냥용)
            if ((diet === 'carnivore' || diet === 'omnivore') && targetAnim) {
                const distSq = this._evaluatePrey(myType, diet, targetAnim, targetStats, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                }
            }

            // 🌿 초식/잡식: 살아있는 식물 (공격/채집용)
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

    _checkItemEdibility(diet, itemType) {
        if (diet === 'carnivore') return itemType === 'meat';
        if (diet === 'herbivore') return ['grass', 'flower', 'fruit', 'kelp', 'moss'].includes(itemType);
        if (diet === 'omnivore') return true; // 잡식은 다 먹음
        return false;
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