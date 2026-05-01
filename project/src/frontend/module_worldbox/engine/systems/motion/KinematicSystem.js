export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;
        // 2. 이동 및 물리 처리 (오직 동물 개체만 물리 연산 수행)
        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const transform = entity.components.get('Transform');
            if (transform && transform.vx !== undefined) {
                // 2a. 속도에 따른 이동 (dt 보정)
                let nextX = transform.x + transform.vx * dt;
                let nextY = transform.y + transform.vy * dt;

                // 2b. 마찰/저항 (속도 감쇠 완화: 0.92 -> 0.96)
                transform.vx *= 0.96;
                transform.vy *= 0.96;

                // 2c. 🏢 건물 충돌/경계 검사 (밀어내지 않고 위치만 제약)
                // 건물 내부로 진입하려 하면 그 방향의 이동을 무시
                for (const bId of em.buildingIds) {
                    const buildingEntity = em.entities.get(bId);
                    if (!buildingEntity) continue;
                    
                    const bTransform = buildingEntity.components.get('Transform');
                    const bVisual = buildingEntity.components.get('Visual');
                    if (bTransform && bVisual) {
                        const bRadius = (bVisual.size || 40) * 0.45; // 건물 시각적 크기의 45%를 충돌 반경으로
                        
                        const dx = nextX - bTransform.x;
                        const dy = nextY - bTransform.y;
                        const distSq = dx * dx + dy * dy;
                        
                        if (distSq < bRadius * bRadius) {
                            // 충돌 발생! 이전 위치로 유지 (벽처럼 작용)
                            const currentDx = transform.x - bTransform.x;
                            const currentDy = transform.y - bTransform.y;
                            const currentDistSq = currentDx * currentDx + currentDy * currentDy;
                            
                            // 이미 안에 갇혔다면 밖으로 살짝 빼줌, 아니면 이동 취소
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

                // 2d. 월드 경계 제약 (튕겨나가기 방지)
                if (transform.x < 0) { transform.x = 0; transform.vx *= -0.5; }
                if (transform.x > mw) { transform.x = mw; transform.vx *= -0.5; }
                if (transform.y < 0) { transform.y = 0; transform.vy *= -0.5; }
                if (transform.y > mh) { transform.y = mh; transform.vy *= -0.5; }
            }
        }
    }
}
