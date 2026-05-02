import ZoneData from '../../world/zones/ZoneData.js';

export default class ZoneManager {
    constructor(engine) {
        this.engine = engine;
        this.zones = new Map();
        this.nextZoneId = 1;
    }

    createZone(x, y, width, height, type) {
        const id = `zone_${this.nextZoneId++}`;
        const zone = new ZoneData(id, type, x, y, width, height);
        this.zones.set(id, zone);
        return id;
    }

    removeZone(zoneId) {
        const zone = this.zones.get(zoneId);
        if (zone) {
            // 해당 구역에 할당된 작업자들의 Job 해제
            for (const workerId of zone.assignedWorkers) {
                const entity = this.engine.entityManager.entities.get(workerId);
                if (entity) {
                    const jobCtrl = entity.components.get('JobController');
                    if (jobCtrl && jobCtrl.zoneId === zoneId) {
                        jobCtrl.clearJob();
                    }
                }
            }
            this.zones.delete(zoneId);
        }
    }

    getZone(zoneId) {
        return this.zones.get(zoneId);
    }

    getZoneAt(x, y) {
        for (const zone of this.zones.values()) {
            if (zone.contains(x, y)) {
                return zone;
            }
        }
        return null;
    }

    getEntitiesInZone(zoneId) {
        const zone = this.zones.get(zoneId);
        if (!zone) return [];

        const entities = [];
        // spatialHash를 이용하여 구역 내 엔티티 빠르게 검색
        if (this.engine.spatialHash) {
            const ids = this.engine.spatialHash.queryRect(
                zone.bounds.minX, zone.bounds.minY, 
                zone.bounds.width, zone.bounds.height
            );
            for (const id of ids) {
                const entity = this.engine.entityManager.entities.get(id);
                if (entity) {
                    entities.push(entity);
                }
            }
        } else {
            // Fallback: 전체 순회
            for (const entity of this.engine.entityManager.entities.values()) {
                const transform = entity.components.get('Transform');
                if (transform && zone.contains(transform.x, transform.y)) {
                    entities.push(entity);
                }
            }
        }
        return entities;
    }
}
