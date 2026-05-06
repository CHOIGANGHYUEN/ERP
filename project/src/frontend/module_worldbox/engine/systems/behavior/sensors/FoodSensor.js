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
        
        // 🚀 [Expert Optimization] eachInRange + scanLimit 대신 eachInSpiral을 사용하여 가장 가까운 먹이부터 검색
        this.spatialHash.eachInSpiral(x, y, radius, (id) => {
            if (id === animalOrStats.id) return false;

            if (state && state.blacklist && state.blacklist.has(id)) {
                if (Date.now() < state.blacklist.get(id)) return false;
                else state.blacklist.delete(id);
            }

            const entity = em.entities.get(id);
            if (!entity) return false;

            const tPos = entity.components.get('Transform');
            if (!tPos) return false;

            // 📦 [New] 드랍된 아이템 감지
            const droppedItem = entity.components.get('DroppedItem');
            if (droppedItem) {
                const isEdible = this._checkItemEdibility(diet, droppedItem);
                if (isEdible) {
                    const dx = tPos.x - x;
                    const dy = tPos.y - y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        nearestId = id;
                        return true; // 최적의 먹이 발견 시 즉시 중단
                    }
                }
                return false;
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
                    return true;
                }
            }

            // 🌿 초식/잡식: 살아있는 식물 (공격/채집용)
            if ((diet === 'herbivore' || diet === 'omnivore') && targetRes && targetRes.edible) {
                const distSq = this._evaluatePlant(diet, targetRes, tPos, x, y);
                if (distSq !== null && distSq < minDistSq) {
                    minDistSq = distSq;
                    nearestId = id;
                    return true;
                }
            }
            return false;
        });
        return nearestId;
    }

    _checkItemEdibility(diet, item) {
        if (item.category !== 'food') return false;
        if (diet === 'carnivore') return item.itemType === 'meat';
        if (diet === 'herbivore') return item.itemType !== 'meat';
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