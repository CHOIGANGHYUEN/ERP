import { BIOMES, BIOME_PROPERTIES_MAP, TERRAIN_TYPES } from '../TerrainGen.js';

/**
 * 🎨 TerrainColorCache
 * 지형, 바이옴, 비옥도에 따른 색상 데이터 팩킹 및 LUT 캐싱을 담당합니다.
 * TerrainGen.js에서 SRP에 따라 분리되었습니다.
 */
export default class TerrainColorCache {
    constructor(terrainGenFacade) {
        this.tg = terrainGenFacade;
        this.colorLUT = null;
        this._initColorLUT();
    }

    _initColorLUT() {
        if (this.colorLUT) return;
        const buffer = new SharedArrayBuffer(2048 * 4);
        this.colorLUT = new Uint32Array(buffer);
        
        for (let t = 0; t < 8; t++) {
            let baseR = 0, baseG = 0, baseB = 0;
            switch(t) {
                case TERRAIN_TYPES.DEEP_OCEAN: baseR = 10; baseG = 30; baseB = 100; break;
                case TERRAIN_TYPES.OCEAN: baseR = 30; baseG = 80; baseB = 180; break;
                case TERRAIN_TYPES.SAND: baseR = 210; baseG = 190; baseB = 130; break;
                case TERRAIN_TYPES.SOIL: baseR = 120; baseG = 90; baseB = 60; break;
                case TERRAIN_TYPES.LOW_MOUNTAIN: baseR = 100; baseG = 100; baseB = 100; break;
                case TERRAIN_TYPES.HIGH_MOUNTAIN: baseR = 180; baseG = 180; baseB = 180; break;
                default: baseR = 50; baseG = 50; baseB = 50;
            }

            for (let b = 0; b < 16; b++) {
                const biome = BIOME_PROPERTIES_MAP.get(b);
                const isLand = t >= 4;

                for (let fIdx = 0; fIdx < 16; fIdx++) {
                    const fRatio = (fIdx << 4) / 255;
                    let r = baseR, g = baseG, bVal = baseB;

                    if (isLand && biome) {
                        const cLow = biome.colorLow || [120, 100, 80];
                        const cHigh = biome.colorHigh || [60, 180, 40];
                        const br = cLow[0] + (cHigh[0] - cLow[0]) * fRatio;
                        const bg = cLow[1] + (cHigh[1] - cLow[1]) * fRatio;
                        const bb = cLow[2] + (cHigh[2] - cLow[2]) * fRatio;
                        r = Math.floor(r * 0.2 + br * 0.8);
                        g = Math.floor(g * 0.2 + bg * 0.8);
                        bVal = Math.floor(bVal * 0.2 + bb * 0.8);
                    }
                    
                    this.colorLUT[(t << 8) | (b << 4) | fIdx] = (255 << 24) | (bVal << 16) | (g << 8) | r;
                }
            }
        }
    }

    getTerrainColor(idx, viewFlags) {
        const val = this.tg.data.packed[idx];
        if (val === undefined) return 0xFF000000;

        const terrainId = val & 0xFF;
        const biomeId = (val >> 8) & 0xFF;
        const fertility = (val >> 16) & 0xFF;
        
        // 영토 뷰
        const villageId = this.tg.data.territory[idx];
        if (villageId > 0) {
            if (viewFlags.VILLAGETILE) {
                const vColor = this.tg.data.villageColors[villageId];
                if (vColor !== 0xFFFFFFFF) return vColor;
            } else if (viewFlags.NATIONTILE) {
                const nColor = this.tg.data.nationColors[villageId];
                if (nColor !== 0xFFFFFFFF) return nColor;
            }
        }

        // 비옥도 뷰
        if (viewFlags.fertility && terrainId >= 4) {
            if (fertility < 80) return 0x8D6E63;
            if (fertility < 180) return 0x4CAF50;
            return 0x2E7D32;
        }

        // 수질 뷰
        if (viewFlags.water) {
            if (terrainId >= 4) return 0x111111; 
            const wq = (val >> 24) & 0xFF;
            const level = wq >> 6;
            const shades = [0x1565C0, 0x1E88E5, 0x42A5F5, 0x90CAF9];
            return shades[Math.min(3, level)];
        }

        // 광물 뷰
        if (viewFlags.mineral) {
            if (terrainId < 6) return 0x111111;
            const md = (val >> 24) & 0xFF;
            const level = md >> 6;
            const shades = [0x424242, 0x757575, 0xBDBDBD, 0xFFFFFF];
            return shades[Math.min(3, level)];
        }

        // 일반 뷰 (LUT 사용)
        const fIdx = fertility >> 4;
        return this.colorLUT[(terrainId << 8) | (biomeId << 4) | fIdx];
    }
}
