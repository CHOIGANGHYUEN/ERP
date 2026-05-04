import SoilFertility from '../components/environment/SoilFertility.js';
import WaterQuality from '../components/environment/WaterQuality.js';
import MineralDensity from '../components/environment/MineralDensity.js';
import Transform from '../components/motion/Transform.js';
import biomesData from '../config/biomes.json';
import { TerrainLayer, BiomeLayer } from './WorldLayers.js';

export const BIOMES = biomesData.biomes;
export const BIOME_PROPERTIES_MAP = new Map(BIOMES.map(biome => [biome.id, biome]));
export const BIOME_NAMES_TO_IDS = new Map(BIOMES.map(biome => [biome.name, biome.id]));

export const TERRAIN_TYPES = {
    DEEP_OCEAN: 0,
    OCEAN: 1,
    LAKE: 2,
    RIVER: 3,
    SAND: 4,
    SOIL: 5,
    LOW_MOUNTAIN: 6,
    HIGH_MOUNTAIN: 7
};

export default class TerrainGen {
    mapWidth = 0;
    mapHeight = 0;
    
    // 🏗️ [STRUCTURAL SEPARATION] Formal Layer Objects
    terrain = null; // Instance of TerrainLayer
    biomes = null;  // Instance of BiomeLayer
    
    // 환경 수치 레이어 (향후 이들도 Layer 클래스로 추상화 가능)
    fertilityBuffer = null; 
    waterQualityBuffer = null;
    mineralDensityBuffer = null;
    occupancyBuffer = null;

    constructor(entityManager) {
        this.entityManager = entityManager;
    }

    // --- Interface Redirection ---
    // 외부 시스템은 여전히 TerrainGen을 통하지만, 내부적으로는 각 레이어가 처리함
    isValidIndex(idx) { return this.terrain && this.terrain.isValid(idx); }
    getIndex(x, y) { return Math.floor(y) * this.mapWidth + Math.floor(x); }
    
    isLand(idx) { return this.terrain.isLand(idx); }
    isWater(idx) { return this.terrain.isWater(idx); }
    isMountain(idx) { return this.terrain.isMountain(idx); }

    isLandAt(x, y) {
        const idx = this.getIndex(x, y);
        return this.isValidIndex(idx) && this.terrain.isLand(idx);
    }

    isSoilAt(x, y) {
        const idx = this.getIndex(x, y);
        if (!this.isValidIndex(idx)) return false;
        
        // 🔍 [Expert Logic] 단일 점이 아니라 주변 3x3 영역을 검사하여 확실한 토양인지 확인 (건물 크기 고려)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkIdx = this.getIndex(x + dx * 2, y + dy * 2); // 약간 넓게 검사
                if (!this.isValidIndex(checkIdx) || this.terrain.getValue(checkIdx) !== TERRAIN_TYPES.SOIL) {
                    return false;
                }
            }
        }
        return true;
    }

    // 바이옴과 지형 버퍼에 대한 직접 참조 허용 (성능 최적화용)
    get terrainBuffer() { return this.terrain.buffer; }
    get biomeBuffer() { return this.biomes.buffer; }

    getBiomeAt(x, y) {
        const idx = this.getIndex(x, y);
        return this.isValidIndex(idx) ? this.biomes.getValue(idx) : -1;
    }

    isNavigable(x, y) {
        const idx = this.getIndex(x, y);
        if (!this.isValidIndex(idx)) return false;
        if (this.terrain.isWater(idx) || this.terrain.isMountain(idx)) return false;
        if (this.occupancyBuffer[idx] >= 2) return false;
        return true;
    }

    setOccupancy(x, y, value) {
        const idx = this.getIndex(x, y);
        if (this.isValidIndex(idx)) this.occupancyBuffer[idx] = value;
    }

    getOccupancy(x, y) {
        const idx = this.getIndex(x, y);
        return this.isValidIndex(idx) ? this.occupancyBuffer[idx] : 0;
    }

    /** 🧪 비옥도 설정 (외부 시스템 연동용) */
    setFertility(x, y, value) {
        const idx = this.getIndex(x, y);
        if (this.isValidIndex(idx)) {
            this.fertilityBuffer[idx] = Math.max(0, Math.min(255, value));
        }
    }

    /** ⚡ [Ultra-Fast Optimization] Permutation Table for Perlin Noise */
    _p = new Uint8Array(512);
    _initNoise() {
        const p = new Uint8Array(256);
        for(let i=0; i<256; i++) p[i] = i;
        for(let i=255; i>0; i--) {
            const r = Math.floor(Math.random() * (i + 1));
            [p[i], p[r]] = [p[r], p[i]];
        }
        for(let i=0; i<512; i++) this._p[i] = p[i & 255];
    }

    _perlin(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = x * x * x * (x * (x * 6 - 15) + 10);
        const v = y * y * y * (y * (y * 6 - 15) + 10);
        const p = this._p;
        const A = p[X] + Y, AA = p[A], AB = p[A + 1];
        const B = p[X + 1] + Y, BA = p[B], BB = p[B + 1];

        const grad2 = (hash, x, y) => {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        };

        return (1 + (1 - v) * ((1 - u) * grad2(p[AA], x, y) + u * grad2(p[BA], x - 1, y)) +
               v * ((1 - u) * grad2(p[AB], x, y - 1) + u * grad2(p[BB], x - 1, y - 1))) * 0.5;
    }

    /** 🎨 [Ultra-Fast] Color LUT 생성 (지형/바이옴/비옥도 조합 캐싱) */
    colorLUT = new Uint32Array(8 * 16 * 16); 
    _initColorLUT() {
        for(let t=0; t<8; t++) {
            for(let b=0; b<16; b++) {
                const biome = BIOME_PROPERTIES_MAP.get(b);
                for(let f=0; f<16; f++) {
                    const fertility = f * 17; // 0-255
                    let r = 0, g = 0, bl = 0;
                    switch(t) {
                        case 0: r = 10; g = 30; bl = 100; break;
                        case 1: r = 30; g = 80; bl = 180; break;
                        case 4: r = 210; g = 190; bl = 130; break;
                        case 5: r = 120; g = 90; bl = 60; break;
                        case 6: r = 100; g = 100; bl = 100; break;
                        case 7: r = 180; g = 180; bl = 180; break;
                        default: r = 50; g = 50; bl = 50;
                    }
                    if (t === 4 || t === 5) {
                        if (biome) {
                            const fRatio = fertility / 100;
                            const cLow = biome.colorLow || [120, 100, 80];
                            const cHigh = biome.colorHigh || [60, 180, 40];
                            const br = cLow[0] + (cHigh[0] - cLow[0]) * fRatio;
                            const bg = cLow[1] + (cHigh[1] - cLow[1]) * fRatio;
                            const bb = cLow[2] + (cHigh[2] - cLow[2]) * fRatio;
                            r = Math.floor(r * 0.2 + br * 0.8);
                            g = Math.floor(g * 0.2 + bg * 0.8);
                            bl = Math.floor(bl * 0.2 + bb * 0.8);
                        }
                    }
                    this.colorLUT[(t << 8) | (b << 4) | f] = (255 << 24) | (bl << 16) | (g << 8) | r;
                }
            }
        }
    }

    async generateProgressive(mapWidth, mapHeight, engine, onProgress, outStats, waterPixels) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        
        // 1. 버퍼 초기화
        this.terrain = new TerrainLayer(mapWidth, mapHeight);
        this.biomes = new BiomeLayer(mapWidth, mapHeight);
        this.fertilityBuffer = new Uint8Array(mapWidth * mapHeight);
        this.waterQualityBuffer = new Uint8Array(mapWidth * mapHeight);
        this.mineralDensityBuffer = new Uint8Array(mapWidth * mapHeight);
        this.occupancyBuffer = new Uint8Array(mapWidth * mapHeight);

        const seedAlt = Math.random() * 100;
        const seedHum = Math.random() * 100;
        const seedTemp = Math.random() * 100;

        // 🚀 [Expert Optimization] 노이즈 및 컬러 시스템 초기화
        this._initNoise();
        this._initColorLUT();
        
        const maxFertilityTable = new Uint8Array(256);
        BIOMES.forEach(b => {
            maxFertilityTable[b.id] = b.maxFertility || 0;
        });

        const colorLUT = this.colorLUT;

        const steps = [16, 4, 1];
        const cm = engine.chunkManager;
        const cmBuffer = cm.buffer;
        
        const terrainBuf = this.terrain.buffer;
        const biomeBuf = this.biomes.buffer;
        const fertBuf = this.fertilityBuffer;
        const wqBuf = this.waterQualityBuffer;
        const mdBuf = this.mineralDensityBuffer;

        for (const step of steps) {
            const batchSize = step === 1 ? 64 : 256; 

            for (let y = 0; y < mapHeight; y += step) {
                const ny = y / mapHeight;
                const cy = ny - 0.5;

                for (let x = 0; x < mapWidth; x += step) {
                    const idx = y * mapWidth + x;
                    const nx = x / mapWidth;
                    const cx = nx - 0.5;

                    // 🏎️ [Ultra-Fast Perlin] Trig 제거
                    let altitude = this._perlin(nx * 4 + seedAlt, ny * 4 + seedAlt) * 0.5 +
                                   this._perlin(nx * 8 + seedAlt, ny * 8 + seedAlt) * 0.25 +
                                   this._perlin(nx * 16 + seedAlt, ny * 16 + seedAlt) * 0.125;
                    
                    const distSq = cx * cx + cy * cy;
                    const mask = Math.max(0, 1.0 - Math.pow(distSq * 4.0, 0.75));
                    altitude *= mask;

                    const humidity = this._perlin(nx * 3 + seedHum, ny * 3 + seedHum) * 0.5 + 0.5;
                    const temperature = this._perlin(nx * 2 + seedTemp, ny * 2 + seedTemp) * 0.5 + 0.5;

                    let terrainId = 5; // SOIL
                    if (altitude < 0.25) terrainId = 0; // DEEP
                    else if (altitude < 0.40) terrainId = 1; // OCEAN
                    else if (altitude < 0.45) terrainId = 4; // SAND
                    else if (altitude > 0.80) terrainId = 7; // HIGH
                    else if (altitude > 0.65) terrainId = 6; // LOW

                    terrainBuf[idx] = terrainId;

                    let biomeId = 5; 
                    if (terrainId === 6) biomeId = 8;
                    else if (terrainId === 7) biomeId = 9;
                    else if (terrainId === 4) biomeId = 4;
                    else if (terrainId <= 1) biomeId = terrainId; 
                    else {
                        if (humidity > 0.7 && temperature > 0.6) biomeId = 7;
                        else if (humidity > 0.4) biomeId = 6;
                    }
                    biomeBuf[idx] = biomeId;

                    const fert = (terrainId === 4 || terrainId === 5) ? Math.floor(25 + Math.random() * 200) : 0;
                    fertBuf[idx] = fert;
                    wqBuf[idx] = (terrainId <= 1) ? 200 : 0;
                    mdBuf[idx] = (terrainId >= 6) ? 230 : 0;

                    // 📊 [Optimization] 최종 단계(Step 1)에서 통계 및 수역 데이터 합산 병행
                    if (step === 1) {
                        if (outStats) {
                            outStats.totalFertility += fert;
                            outStats.potentialFertility += maxFertilityTable[biomeId];
                        }
                        if (waterPixels && (biomeId <= 3)) {
                            waterPixels[engine.waterCount++] = idx;
                        }
                    }

                    // 🎨 [Ultra-Fast] Direct Buffer Write using LUT
                    const fIdx = fert >> 4; // 0-15
                    const color = colorLUT[(terrainId << 8) | (biomeId << 4) | fIdx];
                    
                    // Fill ChunkManager buffer directly
                    if (step === 1) {
                        cmBuffer[idx] = color;
                    } else {
                        for (let dy = 0; dy < step && y + dy < mapHeight; dy++) {
                            const rOff = (y + dy) * mapWidth;
                            for (let dx = 0; dx < step && x + dx < mapWidth; dx++) {
                                const nIdx = rOff + (x + dx);
                                cmBuffer[nIdx] = color;
                                if (dx === 0 && dy === 0) continue;
                                terrainBuf[nIdx] = terrainId;
                                biomeBuf[nIdx] = biomeId;
                                fertBuf[nIdx] = fert;
                                wqBuf[nIdx] = wqBuf[idx];
                                mdBuf[nIdx] = mdBuf[idx];
                            }
                        }
                    }
                }

                if (y % batchSize === 0) {
                    if (onProgress) onProgress();
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
            if (onProgress) onProgress();
            await new Promise(resolve => setTimeout(resolve, 20)); 
        }
    }

    generate(mapWidth, mapHeight) {
        // 동기식 생성 로직 (레거시 지원 및 즉시 생성이 필요한 경우)
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        
        this.terrain = new TerrainLayer(mapWidth, mapHeight);
        this.biomes = new BiomeLayer(mapWidth, mapHeight);
        this.fertilityBuffer = new Uint8Array(mapWidth * mapHeight);
        this.waterQualityBuffer = new Uint8Array(mapWidth * mapHeight);
        this.mineralDensityBuffer = new Uint8Array(mapWidth * mapHeight);
        this.occupancyBuffer = new Uint8Array(mapWidth * mapHeight);

        const seedAlt = Math.random() * 100;
        const seedHum = Math.random() * 100;
        const seedTemp = Math.random() * 100;

        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const idx = y * mapWidth + x;
                const nx = x / mapWidth;
                const ny = y / mapHeight;

                let altitude = this._getFractalNoise(nx, ny, seedAlt);
                const humidity = this._getFractalNoise(nx, ny, seedHum);
                const temperature = this._getFractalNoise(nx, ny, seedTemp);

                const cx = nx - 0.5;
                const cy = ny - 0.5;
                const dist = Math.sqrt(cx * cx + cy * cy) * 2.0;
                const mask = Math.max(0, 1.0 - Math.pow(dist, 1.5));
                altitude *= mask;

                this.generateTileAndBuffers(x, y, altitude, humidity, temperature, idx);
            }
        }
    }

    generateTileAndBuffers(x, y, altitude, humidity, temperature, idx) {
        const terrainId = this.determineTerrainType(altitude);
        this.terrain.setValue(idx, terrainId);

        const biomeId = this.determineInitialBiome(terrainId, humidity, temperature);
        this.biomes.setValue(idx, biomeId);

        const { soilFertility, waterQuality, mineralDensity } = this.calculateEnvironmentValues(terrainId, biomeId, altitude, humidity, temperature);
        this.fertilityBuffer[idx] = soilFertility;
        this.waterQualityBuffer[idx] = waterQuality;
        this.mineralDensityBuffer[idx] = mineralDensity;
    }

    determineTerrainType(altitude) {
        if (altitude < 0.25) return TERRAIN_TYPES.DEEP_OCEAN;
        if (altitude < 0.40) return TERRAIN_TYPES.OCEAN;
        if (altitude < 0.45) return TERRAIN_TYPES.SAND;
        if (altitude > 0.80) return TERRAIN_TYPES.HIGH_MOUNTAIN;
        if (altitude > 0.65) return TERRAIN_TYPES.LOW_MOUNTAIN;
        return TERRAIN_TYPES.SOIL;
    }

    determineInitialBiome(terrainId, humidity, temperature) {
        // ⛰️ 산 지형 판별 (버그 수정: 산이 육지(DIRT)로 변질되는 현상 방지)
        if (terrainId === TERRAIN_TYPES.LOW_MOUNTAIN) return BIOME_NAMES_TO_IDS.get('LOW_MOUNTAIN') || 8;
        if (terrainId === TERRAIN_TYPES.HIGH_MOUNTAIN) return BIOME_NAMES_TO_IDS.get('HIGH_MOUNTAIN') || 9;

        // 🏖️ 모래 지형 판별
        if (terrainId === TERRAIN_TYPES.SAND) return BIOME_NAMES_TO_IDS.get('SAND') || 4;
        
        // 🌊 물 지형 판별 (심해, 바다, 호수, 강을 정확하게 매핑)
        if (terrainId === TERRAIN_TYPES.DEEP_OCEAN) return BIOME_NAMES_TO_IDS.get('DEEP_OCEAN') || 0;
        if (terrainId === TERRAIN_TYPES.OCEAN) return BIOME_NAMES_TO_IDS.get('OCEAN') || 1;
        if (terrainId === TERRAIN_TYPES.LAKE) return BIOME_NAMES_TO_IDS.get('LAKE') || 2;
        if (terrainId === TERRAIN_TYPES.RIVER) return BIOME_NAMES_TO_IDS.get('RIVER') || 3;
        
        // 🌳 육지(SOIL): 습도/온도에 따라 초기 바이옴 할당
        if (humidity > 0.7 && temperature > 0.6) return BIOME_NAMES_TO_IDS.get('JUNGLE') || 7;
        if (humidity > 0.4) return BIOME_NAMES_TO_IDS.get('GRASS') || 6;
        return BIOME_NAMES_TO_IDS.get('DIRT') || 5;
    }

    calculateEnvironmentValues(terrainId, biomeId, altitude, humidity, temperature) {
        const isFertile = [TERRAIN_TYPES.SAND, TERRAIN_TYPES.SOIL].includes(terrainId);
        const isWater = [0, 1, 2, 3].includes(terrainId);
        const isMountain = [6, 7].includes(terrainId);
        
        return {
            // 🧪 0-255 범위로 정수화하여 메모리 최적화
            soilFertility: isFertile ? Math.floor(25 + Math.random() * 200) : 0,
            waterQuality: isWater ? 200 : 0,
            mineralDensity: isMountain ? 230 : 0
        };
    }

    _getFractalNoise(nx, ny, seed) {
        let e = 1.0 * this._noise(nx, ny, 6, seed)
            + 0.5 * this._noise(nx, ny, 12, seed + 10)
            + 0.25 * this._noise(nx, ny, 24, seed + 20)
            + 0.125 * this._noise(nx, ny, 48, seed + 30);
        return e / 1.875;
    }

    _noise(nx, ny, freq, seed) {
        const x = nx * freq;
        const y = ny * freq;
        return (Math.sin(x + seed) + Math.cos(y + seed) + Math.sin((x + y) * 1.4 + seed) + Math.cos((x - y) * 1.4 + seed)) / 4 + 0.5;
    }

    getTerrainColor(idx, viewFlags) {
        const terrainId = this.terrain.getValue(idx);
        const biomeId = this.biomes.getValue(idx);
        const fertility = this.fertilityBuffer[idx];
        
        let r = 0, g = 0, b = 0;
        switch(terrainId) {
            case TERRAIN_TYPES.DEEP_OCEAN: r = 10; g = 30; b = 100; break;
            case TERRAIN_TYPES.OCEAN: r = 30; g = 80; b = 180; break;
            case TERRAIN_TYPES.SAND: r = 210; g = 190; b = 130; break;
            case TERRAIN_TYPES.SOIL: r = 120; g = 90; b = 60; break;
            case TERRAIN_TYPES.LOW_MOUNTAIN: r = 100; g = 100; b = 100; break;
            case TERRAIN_TYPES.HIGH_MOUNTAIN: r = 180; g = 180; b = 180; break;
            default: r = 50; g = 50; b = 50;
        }

        if (this.terrain.isLand(idx)) {
            const biome = BIOME_PROPERTIES_MAP.get(biomeId);
            if (biome) {
                const fRatio = fertility / 100;
                const cLow = biome.colorLow || [120, 100, 80];
                const cHigh = biome.colorHigh || [60, 180, 40];
                const br = cLow[0] + (cHigh[0] - cLow[0]) * fRatio;
                const bg = cLow[1] + (cHigh[1] - cLow[1]) * fRatio;
                const bb = cLow[2] + (cHigh[2] - cLow[2]) * fRatio;
                r = Math.floor(r * 0.2 + br * 0.8);
                g = Math.floor(g * 0.2 + bg * 0.8);
                b = Math.floor(b * 0.2 + bb * 0.8);
            }
        }

        if (viewFlags.fertility && this.terrain.isLand(idx)) {
            if (fertility < 80) return 0x8D6E63;
            if (fertility < 180) return 0x4CAF50;
            return 0x2E7D32;
        }

        // 2. 💧 수질 뷰 (Water Quality View)
        if (viewFlags.water) {
            if (!this.terrain.isWater(idx)) return 0x111111; 
            const wq = this.waterQualityBuffer[idx];
            const level = wq >> 6; // 0-255를 4단계(0-3)로 고속 변환
            const shades = [0x1565C0, 0x1E88E5, 0x42A5F5, 0x90CAF9];
            return shades[Math.min(3, level)];
        }

        // 3. 💎 광물 밀도 뷰 (Mineral Density View)
        if (viewFlags.mineral) {
            if (!this.terrain.isMountain(idx)) return 0x111111;
            const md = this.mineralDensityBuffer[idx];
            const level = md >> 6; // 0-255를 4단계(0-3)로 고속 변환
            const shades = [0x424242, 0x757575, 0xBDBDBD, 0xFFFFFF];
            return shades[Math.min(3, level)];
        }

        return (r << 16) | (g << 8) | b;
    }
}