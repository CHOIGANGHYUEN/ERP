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

        // 🚀 [Expert Optimization] 물리 연산 시작 직전에 동적 해시를 초기화합니다.
        // 이를 통해 AI 시스템(이전 단계)들은 전 프레임의 위치 정보를 안전하게 참조할 수 있습니다.
        if (spatialHash) spatialHash.clearDynamic();

        // 🚀 [Optimization] 카메라 가시 영역 계산 (LOD용)
        const margin = 100;
        const viewX = camera.x - margin;
        const viewY = camera.y - margin;
        const viewW = (camera.width / camera.zoom) + (margin * 2);
        const viewH = (camera.height / camera.zoom) + (margin * 2);

        // 👤 [Unified Physics] 중복 없이 동물과 인간 모두 관성 제거 및 물리 연산 적용
        // 🚀 [Optimization] Set 생성 및 Spread 연산자를 제거하여 매 프레임 발생하는 메모리 할당 방지
        this._updateEntityList(em.animalIds, em, viewX, viewY, viewW, viewH, mw, mh, dt, frameCount, spatialHash);
        this._updateEntityList(em.humanIds, em, viewX, viewY, viewW, viewH, mw, mh, dt, frameCount, spatialHash);
    }

    _updateEntityList(ids, em, viewX, viewY, viewW, viewH, mw, mh, dt, frameCount, spatialHash) {
        const buffer = em.transformBuffer;
        const tg = this.engine.terrainGen;

        for (const id of ids) {
            const idx = id * 4;
            const x = buffer[idx];
            const y = buffer[idx + 1];
            const vx = buffer[idx + 2];
            const vy = buffer[idx + 3];

            // 1. [Physics LOD] 화면 밖 개체는 물리 연산 빈도 낮춤 (20fps 수준)
            const isVisible = (x > viewX && x < viewX + viewW && 
                               y > viewY && y < viewY + viewH);
            
            if (!isVisible) {
                // 화면 밖 개체는 3프레임에 한 번만 물리 연산 수행 (분산 처리)
                if ((id + frameCount) % 3 !== 0) {
                    buffer[idx] += vx * dt;
                    buffer[idx + 1] += vy * dt;
                    if (spatialHash) spatialHash.insert(id, buffer[idx], buffer[idx + 1], false);
                    continue; 
                }
            }

            // 🛑 [Grabbed Check] (이 부분은 여전히 엔티티 조회가 필요함)
            const entity = em.entities.get(id);
            if (!entity) continue;
            
            const aiState = entity.components.get('AIState');
            if (aiState && aiState.mode === 'grabbed') continue;

            // 2. 이동 연산
            let nextX = x + vx * dt;
            let nextY = y + vy * dt;

            // 3. 지형 검사 (Navigable - 최종 안전 장치)
            if (tg && !tg.isNavigable(nextX, nextY)) {
                buffer[idx + 2] = 0; // vx = 0
                buffer[idx + 3] = 0; // vy = 0
                nextX = x;
                nextY = y;
            }

            // 4. 위치 최종 확정 및 경계 체크
            const finalX = Math.max(0, Math.min(mw, nextX));
            const finalY = Math.max(0, Math.min(mh, nextY));

            buffer[idx] = finalX;
            buffer[idx + 1] = finalY;

            if (finalX <= 0 || finalX >= mw) buffer[idx + 2] = 0;
            if (finalY <= 0 || finalY >= mh) buffer[idx + 3] = 0;

            // 6. 🧭 방향 및 애니메이션 데이터 갱신 (보이는 개체만 정밀하게)
            if (isVisible) {
                const speedSq = vx * vx + vy * vy;
                if (speedSq > 2.25) { // speed > 1.5
                    const visual = entity.components.get('Visual');
                    if (visual) {
                        const angle = Math.atan2(vy, vx);
                        const dirIdx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
                        visual.facing = dirIdx;
                        visual.flipX = (dirIdx >= 3 && dirIdx <= 5);
                    }
                }
            }

            // 7. 🚀 [Optimization] 공간 해시 갱신
            if (spatialHash) {
                spatialHash.insertDynamic(id, finalX, finalY);
            }
        }
    }
}
