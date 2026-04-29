import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';

export default class EnvironmentSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; 
        this.backBuffer = null;
        this.lastTick = 0;
        this.tickInterval = 1000;
    }


    /**
     * [4단계] 비옥도 농도 기울기 확산 및 토지 0.1 하한선 보호
     */
    update(dt, time) {
        if (time - this.lastTick < this.tickInterval) return;
        this.lastTick = time;

        const mw = this.terrainGen.mapWidth;
        const mh = this.terrainGen.mapHeight;
        const fb = this.terrainGen.fertilityBuffer;
        const bb = this.terrainGen.biomeBuffer;

        if (!this.backBuffer || this.backBuffer.length !== fb.length) {
            this.backBuffer = new Float32Array(fb.length);
        }
        this.backBuffer.set(fb);

        for (let y = 1; y < mh - 1; y++) {
            for (let x = 1; x < mw - 1; x++) {
                const idx = y * mw + x;
                const bId = bb[idx];
                
                const targetMax = this.getMaxFertility(bId);
                const isLand = [5, 6, 7].includes(bId);

                // 비토지 지형은 확산 원천 차단
                if (targetMax <= 0 || !isLand) {
                    this.backBuffer[idx] = 0;
                    continue;
                }

                const currentVal = fb[idx];
                const neighbors = [idx - mw, idx + mw, idx - 1, idx + 1];
                let sum = currentVal;
                let count = 1;

                for (const nidx of neighbors) {
                    const nMax = this.getMaxFertility(bb[nidx]);
                    if (nMax > 0) {
                        sum += fb[nidx];
                        count++;
                    }
                }

                const avg = sum / count;
                // 평준화 계수 0.15 적용 및 토지 0.1 하한선 보호
                const spreadVal = currentVal + (avg - currentVal) * 0.15;
                this.backBuffer[idx] = Math.max(0.1, Math.min(targetMax, spreadVal));
            }
        }

        fb.set(this.backBuffer);
        this.eventBus.emit('REFRESH_FERTILITY_VIEW');
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
                // 🎲 0.1(최소) ~ 1.0(최대) 사이의 무작위 값 부여
                fb[i] = 0.1 + Math.random() * 0.9;
            } else {
                fb[i] = 0.0;
            }
        }
        this.eventBus.emit('REFRESH_FERTILITY_VIEW');
    }

    getMaxFertility(biomeId) {
        const props = BIOME_PROPERTIES_MAP.get(biomeId);
        if (!props) return 0.0;
        
        const isLand = [5, 6, 7].includes(biomeId);
        if (!isLand) return 0.0;

        // [사용자 요청 반영] 모든 토지의 비옥도 수용량을 1.0으로 통일하여 랜덤 주입된 값이 보존되도록 함
        return 1.0;
    }


    changePixelBiome(idx, biomeId) {
        const tg = this.terrainGen;
        tg.biomeBuffer[idx] = biomeId;
        
        const isLand = [5, 6, 7].includes(biomeId);
        if (isLand) {
            // 변경 시에도 랜덤성 부여 (선택사항: 여기서는 최소 0.1 보장하며 약간의 랜덤성)
            tg.fertilityBuffer[idx] = 0.1 + Math.random() * 0.4;
        } else {
            tg.fertilityBuffer[idx] = 0.0;
        }
        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: idx % tg.mapWidth, y: Math.floor(idx / tg.mapWidth), reason: 'biome_change' });
    }

    flattenToMax() {
        this.randomizeLand(); // 평탄화 대신 랜덤화를 기본 동작으로 변경
    }
}