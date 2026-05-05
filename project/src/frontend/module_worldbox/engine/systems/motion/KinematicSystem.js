export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        const bm = em.bufferManager; // 🚀 [DOD] 버퍼 매니저 참조
        const camera = this.engine.camera;
        const spatialHash = this.engine.spatialHash;
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;
        const frameCount = this.engine.frameCount || 0;

        // 🚀 [Optimization] 카메라 가시 영역 계산 (LOD용)
        const margin = 100;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        // 🏃 모든 동적 개체 이동 연산 (동물, 떨어지는 자원 등)
        for (const [id, entity] of em.entities) {
            // 🚀 [DOD] 버퍼에서 직접 데이터 추출 (객체 조회 제거)
            let x = bm.x[id];
            let y = bm.y[id];
            let vx = bm.vx[id];
            let vy = bm.vy[id];
            const isFalling = bm.isFalling[id] === 1;

            // 정적 개체 최적화 패스 (안 움직이고, 떨어지지 않고, 동물이 아니면)
            if (vx === 0 && vy === 0 && !isFalling && !em.animalIds.has(id)) {
                continue;
            }

            // 1. [Physics LOD] 화면 밖 개체 연산 최적화
            const isVisible = (x > viewX && x < viewX + viewW && 
                               y > viewY && y < viewY + viewH);
            
            if (!isVisible) {
                if ((id + frameCount) % 3 !== 0) {
                    bm.x[id] += vx * dt;
                    bm.y[id] += vy * dt;
                    continue; 
                }
            }

            // 🛑 [AI State Check] - 복잡한 상태는 아직 컴포넌트 참조 (점진적 전환)
            const aiState = entity.components.get('AIState');
            if (aiState && aiState.mode === 'grabbed') continue;

            // 2. 이동 및 마찰력 계산
            let nextX = x + vx * dt;
            let nextY = y + vy * dt;

            // 🛑 [Falling Logic]
            if (isFalling) {
                const targetComp = entity.components.get('TargetY');
                if (targetComp && nextY >= targetComp.y) {
                    nextY = targetComp.y;
                    vy = 0;
                    bm.isFalling[id] = 0; // 착지 완료
                    entity.components.delete('TargetY');
                    
                    // 파티클 효과 발생
                    if (this.engine.eventBus) {
                        this.engine.eventBus.emit('SPAWN_DUST', { detail: { x: nextX, y: nextY } });
                    }
                    
                    // 공간 해시에 다시 정적으로 갱신 (선택적)
                    if (spatialHash && !em.animalIds.has(id) && !em.humanIds.has(id)) {
                        spatialHash.insert(id, nextX, nextY, true);
                    }
                }
            } else {
                let friction = 0.92;
                const interactionStates = ['eat', 'sleep', 'gather_wood', 'gather_plant', 'build', 'pickup', 'deposit', 'socializing'];
                if (aiState && interactionStates.includes(aiState.mode)) {
                    friction = 0.5;
                }

                vx *= friction;
                vy *= friction;

                if (Math.abs(vx) < 0.1) vx = 0;
                if (Math.abs(vy) < 0.1) vy = 0;
            }

            // 3. 지형 검사 (Navigable)
            if (this.engine.terrainGen && !this.engine.terrainGen.isNavigable(nextX, nextY)) {
                if (this.engine.terrainGen.isNavigable(nextX, y)) {
                    nextY = y; vy = 0;
                } else if (this.engine.terrainGen.isNavigable(x, nextY)) {
                    nextX = x; vx = 0;
                } else {
                    nextX = x; nextY = y; vx = 0; vy = 0;
                }
            }

            // 4. 🏢 건물 충돌 (Spatial Hash)
            if (spatialHash) {
                const nearbyIds = spatialHash.query(nextX, nextY, 30);
                for (let i = 0; i < nearbyIds.length; i++) {
                    const bId = nearbyIds[i];
                    if (bId === id) continue;
                    
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
                            const dist = Math.sqrt(distSq) || 1;
                            const overlap = bRadius - dist;
                            nextX += (dx / dist) * (overlap + 0.5);
                            nextY += (dy / dist) * (overlap + 0.5);
                            vx *= 0.5; vy *= 0.5;
                        }
                    }
                }
            }

            // 5. 위치 최종 확정 및 경계 체크
            if (nextX < 0)  { nextX = 0; vx *= -0.5; }
            else if (nextX > mw) { nextX = mw; vx *= -0.5; }
            if (nextY < 0)  { nextY = 0; vy *= -0.5; }
            else if (nextY > mh) { nextY = mh; vy *= -0.5; }

            // 🚀 [DOD] 버퍼에 결과 저장
            bm.x[id] = nextX;
            bm.y[id] = nextY;
            bm.vx[id] = vx;
            bm.vy[id] = vy;

            // 6. 🧭 방향 및 애니메이션 데이터 갱신
            if (isVisible) {
                if (vx * vx + vy * vy > 2.25) {
                    const visual = entity.components.get('Visual');
                    if (visual) {
                        const angle = Math.atan2(vy, vx);
                        const idx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
                        visual.facing = idx;
                        visual.flipX = (idx >= 3 && idx <= 5);
                    }
                }
            }

            // 7. 🚀 [Optimization] 공간 해시 갱신
            if (spatialHash) {
                spatialHash.insert(id, nextX, nextY, false, true);
            }
        }
    }
}
