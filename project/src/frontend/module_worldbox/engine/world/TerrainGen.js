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

    generate(mapWidth, mapHeight) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        
        // 🏗️ [Memory Optimization] Float32(4B) -> Uint8(1B)로 전면 교체 (75% 절감)
        this.terrain = new TerrainLayer(mapWidth, mapHeight);
        this.biomes = new BiomeLayer(mapWidth, mapHeight);
        
        this.fertilityBuffer = new Uint8Array(mapWidth * mapHeight);
        this.waterQualityBuffer = new Uint8Array(mapWidth * mapHeight); // ⚡ Optimized
        this.mineralDensityBuffer = new Uint8Array(mapWidth * mapHeight); // ⚡ Optimized
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
        // 🏖️ 모래 지형 판별
        if (terrainId === TERRAIN_TYPES.SAND) return BIOME_NAMES_TO_IDS.get('SAND') || 4;
        
        // 🌊 물 지형 판별 (지형 아이디 직접 대조 또는 isWater 유틸리티 사용 가능)
        if ([0, 1, 2, 3].includes(terrainId)) return BIOME_NAMES_TO_IDS.get('OCEAN') || 1;
        
        // 🌳 육지: 습도/온도에 따라 초기 바이옴 할당
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