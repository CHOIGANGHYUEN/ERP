export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;

        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const transform = entity.components.get('Transform');
            if (!transform || transform.vx === undefined) continue;

            // 2a. 속도에 따른 이동
            let nextX = transform.x + transform.vx * dt;
            let nextY = transform.y + transform.vy * dt;

            // 2b. 마찰/저항
            transform.vx *= 0.96;
            transform.vy *= 0.96;

            // 2c. 🌍 지형(Terrain) 이동 가능 여부 검사 (물, 고산 등 진입 방지)
            if (this.engine.terrainGen && !this.engine.terrainGen.isNavigable(nextX, nextY)) {
                // 벽 타기(Sliding) 지원을 위해 축 분리 검사
                if (this.engine.terrainGen.isNavigable(nextX, transform.y)) {
                    nextY = transform.y;
                    transform.vy = 0;
                } else if (this.engine.terrainGen.isNavigable(transform.x, nextY)) {
                    nextX = transform.x;
                    transform.vx = 0;
                } else {
                    nextX = transform.x;
                    nextY = transform.y;
                    transform.vx = 0;
                    transform.vy = 0;
                }
            }

            // 2c. 건물 충돌
            for (const bId of em.buildingIds) {
                const buildingEntity = em.entities.get(bId);
                if (!buildingEntity) continue;
                const bTransform = buildingEntity.components.get('Transform');
                const bVisual = buildingEntity.components.get('Visual');
                if (bTransform && bVisual) {
                    const bRadius = (bVisual.size || 40) * 0.45;
                    const dx = nextX - bTransform.x;
                    const dy = nextY - bTransform.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < bRadius * bRadius) {
                        const currentDx = transform.x - bTransform.x;
                        const currentDy = transform.y - bTransform.y;
                        const currentDistSq = currentDx * currentDx + currentDy * currentDy;
                        if (currentDistSq < bRadius * bRadius) {
                            const dist = Math.sqrt(currentDistSq) || 1;
                            nextX = bTransform.x + (currentDx / dist) * (bRadius + 1);
                            nextY = bTransform.y + (currentDy / dist) * (bRadius + 1);
                        } else {
                            nextX = transform.x;
                            nextY = transform.y;
                        }
                    }
                }
            }

            transform.x = nextX;
            transform.y = nextY;

            // 2d. 월드 경계
            if (transform.x < 0)  { transform.x = 0;  transform.vx *= -0.5; }
            if (transform.x > mw) { transform.x = mw; transform.vx *= -0.5; }
            if (transform.y < 0)  { transform.y = 0;  transform.vy *= -0.5; }
            if (transform.y > mh) { transform.y = mh; transform.vy *= -0.5; }

            // 2e. 🧭 방향 + 모션 상태 동기화
            const speed = Math.sqrt(transform.vx * transform.vx + transform.vy * transform.vy);
            const visual = entity.components.get('Visual');
            const state  = entity.components.get('AIState');

            if (visual && speed > 1.5) {
                // 8방향 facing 계산 (라디안 → 0~7 인덱스)
                const angle = Math.atan2(transform.vy, transform.vx); // -π ~ π
                // 0=E 1=SE 2=S 3=SW 4=W 5=NW 6=N 7=NE  (시계방향)
                const idx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
                visual.facing = idx;
                // 좌우 flipping: 서쪽 방향(3,4,5)이면 flipX
                visual.flipX = (idx >= 3 && idx <= 5);
            }

            // (과거에 물리 속도를 기반으로 state.mode를 강제로 'wander'로 덮어쓰던 로직 제거)
            // 이제 상태 제어는 전적으로 FSM(BehaviorSystem)이 담당합니다.
        }
    }
}
