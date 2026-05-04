export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        const camera = this.engine.camera;
        const spatialHash = this.engine.spatialHash;
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;
        const frameCount = this.engine.frameCount || 0;

        // SystemManager에서 이미 클리어됨

        // 🚀 [Optimization] 카메라 가시 영역 계산 (LOD용)
        const margin = 100;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        for (const id of em.animalIds) {
            const entity = em.entities.get(id);
            if (!entity) continue;

            const transform = entity.components.get('Transform');
            if (!transform) continue;

            // 1. [Physics LOD] 화면 밖 개체는 물리 연산 빈도 낮춤 (20fps 수준)
            const isVisible = (transform.x > viewX && transform.x < viewX + viewW && 
                               transform.y > viewY && transform.y < viewY + viewH);
            
            if (!isVisible) {
                // 화면 밖 개체는 3프레임에 한 번만 물리 연산 수행 (분산 처리)
                if ((id + frameCount) % 3 !== 0) {
                    // 위치만 대략 업데이트 (마찰력 등은 건너뜀)
                    transform.x += transform.vx * dt;
                    transform.y += transform.vy * dt;
                    continue; 
                }
            }

            // 🛑 [Drag & Drop Protection]
            const aiState = entity.components.get('AIState');
            if (aiState && aiState.mode === 'grabbed') continue;

            // 2. 이동 및 마찰력 계산
            let nextX = transform.x + transform.vx * dt;
            let nextY = transform.y + transform.vy * dt;

            // 🛑 [Stability] 상호작용 중에는 급제동 (관성 제거)
            let friction = 0.92;
            const interactionStates = ['eat', 'sleep', 'gather_wood', 'gather_plant', 'build', 'pickup', 'deposit', 'socializing'];
            if (aiState && interactionStates.includes(aiState.mode)) {
                friction = 0.5; // 급격한 속도 감쇄
            }

            transform.vx *= friction;
            transform.vy *= friction;

            // 정지 임계값 처리 (미세하게 떨리는 현상 방지)
            if (Math.abs(transform.vx) < 0.1) transform.vx = 0;
            if (Math.abs(transform.vy) < 0.1) transform.vy = 0;

            // 3. 지형 검사 (Navigable)
            if (this.engine.terrainGen && !this.engine.terrainGen.isNavigable(nextX, nextY)) {
                if (this.engine.terrainGen.isNavigable(nextX, transform.y)) {
                    nextY = transform.y;
                    transform.vy = 0;
                } else if (this.engine.terrainGen.isNavigable(transform.x, nextY)) {
                    nextX = transform.x;
                    transform.vx = 0;
                } else {
                    nextX = transform.x; nextY = transform.y;
                    transform.vx = 0; transform.vy = 0;
                }
            }

            // 4. 🚀 [Expert Optimization] 건물 충돌 (Spatial Hash 기반 쿼리)
            // 전체 건물 루프(em.buildingIds) 대신 주변 건물만 쿼리하여 성능 폭증 방지
            if (spatialHash) {
                const nearbyIds = spatialHash.query(nextX, nextY, 30);
                for (let i = 0; i < nearbyIds.length; i++) {
                    const bId = nearbyIds[i];
                    const bEnt = em.entities.get(bId);
                    if (!bEnt || !bEnt.components.has('Building')) continue;

                    const door = bEnt.components.get('Door');
                    if (door && door.isOpen) continue;

                    const bT = bEnt.components.get('Transform');
                    const bV = bEnt.components.get('Visual');
                    if (bT && bV) {
                        const bRadius = (bV.size || 40) * 0.45;
                        const dx = nextX - bT.x;
                        const dy = nextY - bT.y;
                        const distSq = dx * dx + dy * dy;
                        
                        if (distSq < bRadius * bRadius) {
                            // 밀어내기 로직 (입사각/반사각 대신 간단한 거리 기반 밀어내기)
                            const dist = Math.sqrt(distSq) || 1;
                            const overlap = bRadius - dist;
                            nextX += (dx / dist) * (overlap + 0.5);
                            nextY += (dy / dist) * (overlap + 0.5);
                            
                            // 속도 상쇄
                            transform.vx *= 0.5;
                            transform.vy *= 0.5;
                        }
                    }
                }
            }

            // 5. 위치 최종 확정 및 경계 체크
            transform.x = nextX;
            transform.y = nextY;

            if (transform.x < 0)  { transform.x = 0;  transform.vx *= -0.5; }
            else if (transform.x > mw) { transform.x = mw; transform.vx *= -0.5; }
            if (transform.y < 0)  { transform.y = 0;  transform.vy *= -0.5; }
            else if (transform.y > mh) { transform.y = mh; transform.vy *= -0.5; }

            // 6. 🧭 방향 및 애니메이션 데이터 갱신 (보이는 개체만 정밀하게)
            if (isVisible) {
                const speedSq = transform.vx * transform.vx + transform.vy * transform.vy;
                if (speedSq > 2.25) { // speed > 1.5
                    const visual = entity.components.get('Visual');
                    if (visual) {
                        const angle = Math.atan2(transform.vy, transform.vx);
                        const idx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
                        visual.facing = idx;
                        visual.flipX = (idx >= 3 && idx <= 5);
                    }
                }
            }

            // 7. 🚀 [Optimization] 공간 해시 갱신 (별도 루프 제거)
            if (spatialHash) {
                spatialHash.insert(id, transform.x, transform.y, false);
            }
        }
    }
}
