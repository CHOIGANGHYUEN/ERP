import SpatialHash from '../../utils/SpatialHash.js';
import MathUtils from '../../utils/MathUtils.js';

export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
        this.spatialHash = new SpatialHash(50); // 객체 분리를 위한 셀 크기
    }

    update(dt) {
        const em = this.engine.entityManager;
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;
        const entities = Array.from(em.entities.values());

        // 1. 공간 해시맵 갱신
        this.spatialHash.clear();
        for (const entity of entities) {
            const transform = entity.components.get('Transform');
            if (transform) {
                this.spatialHash.insert(entity.id, transform.x, transform.y);
            }
        }

        // 2. 이동 및 충돌 처리
        for (const entity of entities) {
            const transform = entity.components.get('Transform');
            if (transform && transform.vx !== undefined) {
                // 2a. 객체 분리(Separation) 로직 고도화 (동물끼리 겹침 방지)
                let totalPushX = 0;
                let totalPushY = 0;
                const separationRadius = 22; // 📏 밀어낼 최소 거리 증가 (가시적 겹침 방지)
                const queryRadius = 35;      // 🔍 탐색 반경 확대

                const nearbyIds = this.spatialHash.query(transform.x, transform.y, queryRadius);
                for (const otherId of nearbyIds) {
                    if (entity.id === otherId) continue;

                    const otherEntity = em.entities.get(otherId);
                    if (otherEntity) {
                        const otherTransform = otherEntity.components.get('Transform');
                        // 분리 로직은 물리적 움직임이 있는 객체끼리만 적용
                        if (otherTransform && otherTransform.vx !== undefined) {
                            const push = MathUtils.resolveCollisionPush(transform, otherTransform, separationRadius);
                            totalPushX += push.pushX;
                            totalPushY += push.pushY;
                        }
                    }
                }
                transform.vx += totalPushX;
                transform.vy += totalPushY;

                // 2b. 속도에 따른 이동
                transform.x += transform.vx * dt;
                transform.y += transform.vy * dt;

                // 2c. 마찰/저항 (단일화된 물리 마찰 처리)
                transform.vx *= 0.92;
                transform.vy *= 0.92;

                // 2d. 월드 경계 제약
                if (transform.x < 0) { transform.x = 0; transform.vx *= -0.5; }
                if (transform.x > mw) { transform.x = mw; transform.vx *= -0.5; }
                if (transform.y < 0) { transform.y = 0; transform.vy *= -0.5; }
                if (transform.y > mh) { transform.y = mh; transform.vy *= -0.5; }
            }
        }
    }
}
