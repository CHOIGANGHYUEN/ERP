/**
 * 🎯 ZoneSensor
 * JobController가 부착된 개체가 담당 구역 안에서만 자원을 탐색하도록 제한하는 센서.
 * FoodSensor의 구역 특화 버전으로, 전체 월드 순회 대신 ZoneManager를 통해
 * O(1)에 가까운 비용으로 구역 내 타겟을 필터링합니다.
 */
export default class ZoneSensor {
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * 개체의 JobController와 zoneId를 확인하여 구역 내 자원을 탐색합니다.
     * @param {Entity} entity - 탐색 주체
     * @param {string} resourceType - 찾으려는 자원 유형 ('wood', 'food', 'stone' 등)
     * @param {Function|null} extraCondition - 추가 필터 조건 (선택)
     * @returns {string|null} 발견된 엔티티 ID 또는 null
     */
    findResourceInZone(entity, resourceType, extraCondition = null) {
        const jobCtrl = entity.components.get('JobController');
        if (!jobCtrl || !jobCtrl.zoneId) return null;

        const zoneManager = this._getZoneManager();
        if (!zoneManager) return null;

        const zoneEntities = zoneManager.getEntitiesInZone(jobCtrl.zoneId);
        if (!zoneEntities.length) return null;

        const transform = entity.components.get('Transform');
        if (!transform) return null;

        let closestId = null;
        let minDistSq = Infinity;

        for (const candidate of zoneEntities) {
            const res = candidate.components.get('Resource');
            if (!res) continue;
            if (resourceType && res.type !== resourceType) continue;
            if (extraCondition && !extraCondition(candidate)) continue;

            const cTransform = candidate.components.get('Transform');
            if (!cTransform) continue;

            const dx = cTransform.x - transform.x;
            const dy = cTransform.y - transform.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestId = candidate.id;
            }
        }

        return closestId;
    }

    /**
     * 구역 내 동물(먹이)을 탐색합니다. (사냥꾼 전용)
     * @param {Entity} entity - 탐색 주체
     * @param {string[]} preyTypes - 사냥 가능한 동물 타입 배열
     * @returns {string|null} 발견된 엔티티 ID 또는 null
     */
    findPreyInZone(entity, preyTypes = []) {
        const jobCtrl = entity.components.get('JobController');
        if (!jobCtrl || !jobCtrl.zoneId) return null;

        const zoneManager = this._getZoneManager();
        if (!zoneManager) return null;

        const zoneEntities = zoneManager.getEntitiesInZone(jobCtrl.zoneId);

        const transform = entity.components.get('Transform');
        if (!transform) return null;

        let closestId = null;
        let minDistSq = Infinity;

        for (const candidate of zoneEntities) {
            if (candidate.id === entity.id) continue;

            const animal = candidate.components.get('Animal');
            if (!animal) continue;
            if (preyTypes.length && !preyTypes.includes(animal.type)) continue;

            const stats = candidate.components.get('BaseStats');
            if (stats && stats.health <= 0) continue;

            const cTransform = candidate.components.get('Transform');
            if (!cTransform) continue;

            const dx = cTransform.x - transform.x;
            const dy = cTransform.y - transform.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestId = candidate.id;
            }
        }

        return closestId;
    }

    _getZoneManager() {
        // engine.systems가 배열인지 Map인지에 따라 탐색 방식 분기
        if (Array.isArray(this.engine.systems)) {
            return this.engine.systems.find(s => s.constructor.name === 'ZoneManager') || null;
        }
        return this.engine.systems?.get?.('ZoneManager') || null;
    }
}
