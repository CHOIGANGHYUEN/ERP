import { DietType } from "../../../components/behavior/State";
export default class PredatorSensor {
    constructor(entityManager, spatialHash) {
        this.entityManager = entityManager;
        this.spatialHash = spatialHash;
    }

    /**
     * 🦁 주변의 포식자(육식동물)를 감지합니다.
     * @returns {string|null} 감지된 포식자의 ID
     */
    findNearestPredator(entity, state, radius = 100) {
        const transform = entity.components.get('Transform');
        if (!transform) return null;

        // 공간 해시를 통해 주변 엔티티만 필터링 (가비지 프리)
        let nearestId = null;
        let minDistSq = radius * radius;

        this.spatialHash.eachInRange(transform.x, transform.y, radius, (id) => {
            if (id === entity.id) return;

            // 🚫 [Expert Optimization] 블랙리스트 필터링 및 청소
            if (state && state.blacklist && state.blacklist.has(id)) {
                if (Date.now() < state.blacklist.get(id)) return;
                else state.blacklist.delete(id); // 만료된 블랙리스트 삭제
            }

            const other = this.entityManager.entities.get(id);
            if (!other) return;

            const otherAnimal = other.components.get('Animal');
            if (otherAnimal && otherAnimal.diet === 'carnivore') {
                const otherTransform = other.components.get('Transform');
                if (otherTransform) {
                    const dx = transform.x - otherTransform.x;
                    const dy = transform.y - otherTransform.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        nearestId = id;
                    }
                }
            }
        });

        return nearestId;
    }
}
