import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';

export default class EnvironmentSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; 
        this.lastTick = 0;
        
        // 🛠️ [SIMULATION DEBUG] 설정 반영
        this.tickInterval = 10;      // 🚀 Spread Speed (100Hz)
        this.maxProcessingPerFrame = 10000; // 🚀 Spread Power
        
        this.activeTiles = new Set(); // 🔥 [Step 1/3] 통합 실시간 큐
    }

    /**
     * 특정 타일을 활성 목록에 추가합니다.
     */
    activateTile(idx) {
        if (idx < 0 || idx >= this.terrainGen.fertilityBuffer.length) return;
        this.activeTiles.add(idx);
    }

    /**
     * [Step 3] 실시간 응답형 고속 비옥도/바이옴 확산
     */
    update(dt, time) {
        if (this.activeTiles.size === 0) return;
        if (time - this.lastTick < this.tickInterval) return;
        this.lastTick = time;

        const mw = this.terrainGen.mapWidth;
        const fb = this.terrainGen.fertilityBuffer;
        const bb = this.terrainGen.biomeBuffer;
        
        const changes = new Map();
        let processedCount = 0;

        // 🚀 [Optimization] Set의 삽입 순서 보장 기능을 활용한 고속 큐 처리
        for (const idx of this.activeTiles) {
            if (processedCount >= this.maxProcessingPerFrame) break;
            
            // 1. 현재 타일 꺼내기 및 카운트
            this.activeTiles.delete(idx);
            processedCount++;

            const bId = bb[idx];
            const targetMax = this.getMaxFertility(bId);
            const isLand = [5, 6, 7].includes(bId);

            if (targetMax <= 0 || !isLand) {
                fb[idx] = 0;
                continue;
            }

            const currentVal = fb[idx];
            const neighbors = [
                idx - mw, idx + mw, idx - 1, idx + 1,
                idx - mw - 1, idx - mw + 1, idx + mw - 1, idx + mw + 1
            ];
            
            let sum = currentVal;
            let count = 1;
            let hasInfectableNeighbor = false;

            for (const nidx of neighbors) {
                if (nidx < 0 || nidx >= fb.length) continue;
                const nbId = bb[nidx];
                if (nbId === 5) hasInfectableNeighbor = true;

                const nMax = this.getMaxFertility(nbId);
                if (nMax > 0) {
                    sum += fb[nidx];
                    count++;
                }
            }

            // 🌿 [Bug Fix] 강력한 바이옴 확산 (8방향, 20% 확률)
            if (bId === 6 || bId === 7) {
                for (const nidx of neighbors) {
                    if (nidx >= 0 && nidx < bb.length && bb[nidx] === 5) {
                        const spreadChance = (nidx === idx - 1 || nidx === idx + 1 || nidx === idx - mw || nidx === idx + mw) ? 0.2 : 0.1;
                        if (Math.random() < spreadChance) {
                            bb[nidx] = bId;
                            this.activateTile(nidx); // 🚀 새로 번진 타일 즉시 큐에 추가
                            this.eventBus.emit('CACHE_PIXEL_UPDATE', { 
                                x: nidx % mw, y: Math.floor(nidx / mw), reason: 'biome_change' 
                            });
                        }
                    }
                }
            }

            // 💧 비옥도 변화 연산
            const avg = Math.floor(sum / count);
            const spreadVal = currentVal + Math.floor((avg - currentVal) * 0.15);
            const finalVal = Math.max(10, Math.min(targetMax, spreadVal));

            if (Math.abs(finalVal - currentVal) >= 1 || hasInfectableNeighbor) {
                if (Math.abs(finalVal - currentVal) >= 1) {
                    changes.set(idx, finalVal);
                }
                
                this.activeTiles.add(idx); // 🚀 상태 유지 타일 다시 큐로
                for (let i = 0; i < 4; i++) {
                    const nidx = neighbors[i];
                    if (nidx >= 0 && nidx < fb.length && [5, 6, 7].includes(bb[nidx])) {
                        this.activeTiles.add(nidx);
                    }
                }
            }
        }




        // 3. 일괄 반영 및 뷰 갱신
        if (changes.size > 0) {
            for (const [idx, val] of changes) {
                fb[idx] = val;
            }
            this.eventBus.emit('REFRESH_FERTILITY_VIEW');
        }
    }



    /**
     * [사용자 요청] 모든 토지 위에 랜덤 비옥도 값 할당 (0.1 ~ 1.0)
     */
    randomizeLand() {
        const fb = this.terrainGen.fertilityBuffer;
        const bb = this.terrainGen.biomeBuffer;
        if (!fb) return;

        for (let i = 0; i < fb.length; i++) {
            const bId = bb[i];
            const isLand = [5, 6, 7].includes(bId);
            
            if (isLand) {
                fb[i] = 10 + Math.floor(Math.random() * 90); // 10~100 사이 정수
                this.activateTile(i);
            } else {
                fb[i] = 0;
            }
        }
        this.eventBus.emit('REFRESH_FERTILITY_VIEW');
    }

    getMaxFertility(biomeId) {
        const props = BIOME_PROPERTIES_MAP.get(biomeId);
        if (!props) return 0;
        
        const isLand = [5, 6, 7].includes(biomeId);
        if (!isLand) return 0;

        return 100; // ⚡ 최대 비옥도 100 (정수)
    }


    changePixelBiome(idx, biomeId) {
        const tg = this.terrainGen;
        tg.biomeBuffer[idx] = biomeId;
        
        const isLand = [5, 6, 7].includes(biomeId);
        if (isLand) {
            tg.fertilityBuffer[idx] = 10 + Math.floor(Math.random() * 40); // 정수 할당
            this.activateTile(idx); // 🔥 [Step 1] 본인 활성화
            // 주변 4칸도 영향을 받으므로 활성화
            const mw = tg.mapWidth;
            this.activateTile(idx - mw); this.activateTile(idx + mw);
            this.activateTile(idx - 1); this.activateTile(idx + 1);
        } else {
            tg.fertilityBuffer[idx] = 0.0;
            this.activateTile(idx);
        }
        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: idx % tg.mapWidth, y: Math.floor(idx / tg.mapWidth), reason: 'biome_change' });
    }


    flattenToMax() {
        this.randomizeLand(); // 평탄화 대신 랜덤화를 기본 동작으로 변경
    }
}