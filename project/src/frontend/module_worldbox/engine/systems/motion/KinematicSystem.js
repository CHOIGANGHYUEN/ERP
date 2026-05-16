import SpatialLODManager from './lod/SpatialLODManager.js';
import CollisionResolver from './physics/CollisionResolver.js';
import FlockingSolver from './physics/FlockingSolver.js';

/**
 * 🏃 KinematicSystem
 * 모든 동적 엔티티의 물리 법칙(Euler Integration), 충돌 회피, 무리 행동 및 LOD 연산을 주관합니다.
 * 리팩토링을 통해 수학 연산 로직을 lod/ 및 physics/ 모듈로 이관하였습니다.
 */
export default class KinematicSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt, frameCount) {
        const em = this.engine.entityManager;
        const mw = this.engine.mapWidth || 2400;
        const mh = this.engine.mapHeight || 2400;
        
        const camera = this.engine.camera;
        const spatialHash = this.engine.spatialHash;
        const fc = frameCount || 0;

        // 🚀 [Expert Optimization] 카메라 가시 영역 계산 (LOD 전용 객체 생성)
        const margin = 300; 
        const view = {
            x: camera.x - margin,
            y: camera.y - margin,
            w: (camera.width / camera.zoom) + (margin * 2),
            h: (camera.height / camera.zoom) + (margin * 2)
        };

        // 👤 [Unified Physics] 동물 및 인간 개체 일괄 물리 업데이트
        this._updateEntityList(em.animalIds, em, view, mw, mh, dt, fc, spatialHash);
    }

    _updateEntityList(ids, em, view, mw, mh, dt, frameCount, spatialHash) {
        const tBuffer = em.transformBuffer;
        const vBuffer = em.velocityBuffer;
        const tg = this.engine.terrainGen;
        const items = ids.items; 

        for (let i = 0; i < items.length; i++) {
            const id = items[i];
            const tIdx = id * 2;
            const vIdx = id * 4;

            const x = tBuffer[tIdx];
            const y = tBuffer[tIdx + 1];
            let vx = vBuffer[vIdx];
            let vy = vBuffer[vIdx + 1];

            // 1. [Spatial LOD] 화면 가시성 및 거리에 따른 연산 스킵 여부 결정
            const lod = SpatialLODManager.getLODLevel(id, x, y, view, frameCount);
            
            if (!lod.shouldUpdate) {
                // 🚀 [Tick Slicing] 연산은 스킵하되, 마지막 속도 기반으로 선형 보간 이동만 수행
                this._applyLinearMovement(id, x, y, vx, vy, dt, tBuffer, em, spatialHash);
                continue; 
            }

            // 틱 슬라이싱으로 인해 건너뛴 프레임만큼 물리 시간(dt) 보정
            const currentDt = dt * lod.skipFactor;

            // 2. [Status Check] Grabbed 상태 등 특수 상황 예외 처리
            const stateBitmask = em.stateBuffer[id * 2 + 1];
            if (stateBitmask & 1) continue; // 1: grabbed

            // 3. [Physics Update] 가속도 적용 및 속도 갱신
            const ax = vBuffer[vIdx + 2];
            const ay = vBuffer[vIdx + 3];
            
            vx += ax * currentDt;
            vy += ay * currentDt;
            
            if (!isFinite(vx)) vx = 0;
            if (!isFinite(vy)) vy = 0;

            vBuffer[vIdx] = vx;
            vBuffer[vIdx + 1] = vy;
            vBuffer[vIdx + 2] = 0; // ax 초기화
            vBuffer[vIdx + 3] = 0; // ay 초기화

            // 4. [Steering & Flocking] 충돌 회피 및 군집 행동 (화면 안에서만 정밀하게)
            let nextX = x + vx * dt;
            let nextY = y + vy * dt;

            if (lod.isVisible) {
                // Separation (충돌 회피)
                const separation = CollisionResolver.resolveSeparation(id, x, y, spatialHash, em, 12);
                nextX += separation.pushX * 0.5;
                nextY += separation.pushY * 0.5;

                // Boids Behavior (Warrior 등 특정 직업군 대상)
                const jobType = em.jobBuffer ? em.jobBuffer[id * 2] : 0;
                if (jobType === 9) { // 9: WARRIOR
                    const alignment = FlockingSolver.resolveAlignment(id, x, y, spatialHash, em, 40);
                    const cohesion = FlockingSolver.resolveCohesion(id, x, y, spatialHash, em, 50);
                    
                    nextX += alignment.avgVx * 0.05 + (cohesion.centerX - x) * 0.02;
                    nextY += alignment.avgVy * 0.05 + (cohesion.centerY - y) * 0.02;
                }
            }

            // 5. [Environment Collision] 지형 내비게이션 제한 및 맵 경계 클램핑
            if (tg && !tg.isNavigable(nextX, nextY)) {
                vBuffer[vIdx] *= 0.1;
                vBuffer[vIdx + 1] *= 0.1;
                nextX = x;
                nextY = y;
            }

            const limitX = (mw || 2400) - 10;
            const limitY = (mh || 2400) - 10;
            const finalX = Math.max(0, Math.min(limitX, nextX));
            const finalY = Math.max(0, Math.min(limitY, nextY));

            if (vx * vx + vy * vy < 0.0025) { 
                vBuffer[vIdx] = 0;
                vBuffer[vIdx + 1] = 0;
            }

            // 6. [Write Back] 결과 버퍼 기록 및 방향 데이터 갱신
            tBuffer[tIdx] = finalX;
            tBuffer[tIdx + 1] = finalY;

            if (lod.isVisible) {
                this._updateFacingDirection(id, vx, vy, em);
            }

            // 7. [Spatial Hash] 증분 업데이트
            this._updateSpatialHash(id, finalX, finalY, em, spatialHash);
        }
    }

    /** 🚀 [Helper] 속도 기반 단순 선형 이동 (LOD 업데이트 스킵 시 사용) */
    _applyLinearMovement(id, x, y, vx, vy, dt, tBuffer, em, spatialHash) {
        const nextX = x + vx * dt;
        const nextY = y + vy * dt;
        if (isFinite(nextX) && isFinite(nextY)) {
            tBuffer[id * 2] = nextX;
            tBuffer[id * 2 + 1] = nextY;
            this._updateSpatialHash(id, nextX, nextY, em, spatialHash);
        }
    }

    /** 🧭 [Helper] 이동 방향에 따른 렌더링 Facing 데이터 업데이트 */
    _updateFacingDirection(id, vx, vy, em) {
        const speedSq = vx * vx + vy * vy;
        if (speedSq > 2.25) { // speed > 1.5
            const rIdx = id * 8;
            const targetAngle = Math.atan2(vy, vx);
            const dirIdx = Math.round(((targetAngle + Math.PI) / (Math.PI * 2)) * 8) % 8;
            
            em.renderBuffer[rIdx + 6] = dirIdx; // facing
            em.renderBuffer[rIdx + 3] = (dirIdx >= 3 && dirIdx <= 5) ? 1 : 0; // flipX
        }
    }

    /** 📍 [Helper] 공간 해시 증분 갱신 (Cell 이동 감지) */
    _updateSpatialHash(id, x, y, em, spatialHash) {
        if (!spatialHash) return;
        const cellSize = spatialHash.cellSize;
        const newKey = ((Math.floor(y / cellSize) + 1000) << 16) | (Math.floor(x / cellSize) + 1000);
        const oldKey = em.cellKeyBuffer[id];
        
        if (newKey !== oldKey) {
            if (oldKey !== -1) spatialHash.removeFromCell(id, oldKey, 0); // 0: Dynamic
            spatialHash.insertWithKey(id, newKey, 0);
            em.cellKeyBuffer[id] = newKey;
        }
    }
}
