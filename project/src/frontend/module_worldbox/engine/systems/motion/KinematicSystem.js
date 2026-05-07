import CollisionSystem from './CollisionSystem.js';

export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt, frameCount) {
        const em = this.engine.entityManager;
        const mw = this.engine.mapWidth || 2400;
        const mh = this.engine.mapHeight || 2400;
        
        if (frameCount < 5 && frameCount % 10 === 0) {
            console.log(`[KinematicSystem] Map Size: ${mw}x${mh}, Entities: ${em.animalIds.size}`);
        }

        const camera = this.engine.camera;
        const spatialHash = this.engine.spatialHash;
        const fc = frameCount || 0;

        // 🚀 [Expert Optimization] 물리 연산 시작 직전에 동적 해시를 초기화합니다.
        // 이를 통해 AI 시스템(이전 단계)들은 전 프레임의 위치 정보를 안전하게 참조할 수 있습니다.
        if (spatialHash) spatialHash.clearDynamic();

        // 🚀 [Optimization] 카메라 가시 영역 계산 (LOD용)
        const margin = 100;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        // 👤 [Unified Physics] 모든 움직이는 개체(동물+인간)에 대해 물리 연산 적용
        // em.animalIds에 이미 인간(human)이 포함되어 있으므로 em.humanIds를 별도로 돌릴 필요가 없음 (이중 업데이트 방지)
        this._updateEntityList(em.animalIds, em, viewX, viewY, viewW, viewH, mw, mh, dt, frameCount, spatialHash);
    }

    _updateEntityList(ids, em, viewX, viewY, viewW, viewH, mw, mh, dt, frameCount, spatialHash) {
        const tBuffer = em.transformBuffer;
        const vBuffer = em.velocityBuffer;
        const tg = this.engine.terrainGen;

        for (const id of ids) {
            const tIdx = id * 2;
            const vIdx = id * 4;

            const x = tBuffer[tIdx];
            const y = tBuffer[tIdx + 1];
            let vx = vBuffer[vIdx];
            let vy = vBuffer[vIdx + 1];
            const ax = vBuffer[vIdx + 2];
            const ay = vBuffer[vIdx + 3];

            // 1. [Physics LOD] 화면 밖 개체는 물리 연산 빈도 낮춤 (20fps 수준)
            const isVisible = (x > viewX && x < viewX + viewW && 
                               y > viewY && y < viewY + viewH);
            
            // 🛑 [LOD Logic]
            if (!isVisible) {
                // 화면 밖 개체는 3프레임에 한 번만 물리 연산 수행 (분산 처리)
                if ((id + frameCount) % 3 !== 0) {
                    const nextX = x + vx * dt;
                    const nextY = y + vy * dt;
                    
                    // 🛡️ [Stability] NaN 방어
                    if (isFinite(nextX) && isFinite(nextY)) {
                        tBuffer[tIdx] = nextX;
                        tBuffer[tIdx + 1] = nextY;
                        if (spatialHash) spatialHash.insertDynamic(id, nextX, nextY);
                    }
                    continue; 
                }
            }

            // 🛑 [Expert Optimization] State Buffer를 이용한 상태 체크 (객체 lookup 제거)
            const sIdx = id * 2;
            const stateBitmask = em.stateBuffer[sIdx + 1];
            if (stateBitmask & 1) continue; // 1: grabbed 상태면 물리 연산 제외

            // 2. 가속도 적용 및 속도 갱신 (DOD)
            vx += ax * dt;
            vy += ay * dt;
            
            // 🛡️ [Stability] 속도 이상 수치(Infinity) 방지
            if (!isFinite(vx)) vx = 0;
            if (!isFinite(vy)) vy = 0;

            vBuffer[vIdx] = vx;
            vBuffer[vIdx + 1] = vy;
            vBuffer[vIdx + 2] = 0; // ax = 0 (가속도는 매 프레임 초기화하여 누적 방지)
            vBuffer[vIdx + 3] = 0; // ay = 0

            // 3. 위치 통합 (Euler)
            let nextX = x + vx * dt;
            let nextY = y + vy * dt;

            // 🛡️ [Step 29] Separation Steering (충돌 회피)
            if (isVisible) {
                const separation = CollisionSystem.resolveSeparation(id, x, y, spatialHash, em, 12);
                const pushWeight = 0.5; // 밀어내는 강도
                nextX += separation.pushX * pushWeight;
                nextY += separation.pushY * pushWeight;
            }

            // 4. 지형 충돌 및 내비게이션 제한 (HPA* 호환)
            if (tg && !tg.isNavigable(nextX, nextY)) {
                // 부딪혔을 때 속도 감쇄
                vBuffer[vIdx] *= 0.1;
                vBuffer[vIdx + 1] *= 0.1;
                nextX = x;
                nextY = y;
            }

            // 5. 맵 경계 클램핑 (0 ~ mw/mh 사이로 제한)
            // 🚀 [Critical Fix] mw, mh가 0이거나 유효하지 않을 경우를 대비한 방어 로직
            const limitX = Math.max(10, (mw || 2400) - 10);
            const limitY = Math.max(10, (mh || 2400) - 10);
            const finalX = Math.max(0, Math.min(limitX, nextX));
            const finalY = Math.max(0, Math.min(limitY, nextY));

            // 6. 결과 버퍼에 쓰기
            tBuffer[tIdx] = finalX;
            tBuffer[tIdx + 1] = finalY;

            if (finalX <= 0 || finalX >= mw - 1) vBuffer[vIdx] = 0;
            if (finalY <= 0 || finalY >= mh - 1) vBuffer[vIdx + 1] = 0;

            // 6. 🧭 방향 데이터 갱신 (DOD Render Buffer Write)
            if (isVisible) {
                const speedSq = vx * vx + vy * vy;
                if (speedSq > 2.25) { // speed > 1.5
                    const rIdx = id * 8;
                    const angle = Math.atan2(vy, vx);
                    const dirIdx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
                    
                    em.renderBuffer[rIdx + 6] = dirIdx; // facing
                    em.renderBuffer[rIdx + 3] = (dirIdx >= 3 && dirIdx <= 5) ? 1 : 0; // flipX
                }
            }

            // 7. 🚀 [Optimization] 공간 해시 갱신
            if (spatialHash) {
                spatialHash.insertDynamic(id, finalX, finalY);
            }
        }
    }
}
