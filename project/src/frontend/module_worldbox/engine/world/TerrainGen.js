import biomesData from '../config/biomes.json';
import TerrainDataBuffers from './terrain_modules/TerrainDataBuffers.js';
import NoiseGenerator from './terrain_modules/NoiseGenerator.js';
import TerrainColorCache from './terrain_modules/TerrainColorCache.js';
import TerrainGenerator from './terrain_modules/TerrainGenerator.js';

// 🌐 Global Constants
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

/**
 * 🌍 TerrainGen (Facade)
 * 지형 시스템의 통합 인터페이스입니다.
 * 리팩토링을 통해 내부 로직을 데이터 버퍼, 노이즈 생성, 컬러 캐시, 생성기로 분리하였습니다.
 */
export default class TerrainGen {
    constructor(engine) {
        this.engine = engine;
        this.mapWidth = 0;
        this.mapHeight = 0;

        // 🚀 전문 서브 시스템 초기화 (의존성 주입 기반)
        this.data = new TerrainDataBuffers(this);
        this.noise = new NoiseGenerator();
        this.colorCache = new TerrainColorCache(this);
        this.generator = new TerrainGenerator(this);
    }

    // --- Legacy Property Accessors (Renderer compatibility) ---
    get terrain() { return this.data.terrain; }
    get biomes() { return this.data.biomes; }
    get fertilityBuffer() { return this.data.fertility; }
    get waterQualityBuffer() { return this.data.waterQuality; }
    get mineralDensityBuffer() { return this.data.mineralDensity; }
    get occupancyBuffer() { return this.data.occupancy; }
    get territoryBuffer() { return this.data.territory; }
    get altitudeBuffer() { return this.data.altitude; }
    get packedBuffer() { return this.data.packed; }
    get villageColorBuffer() { return this.data.villageColors; }
    get nationColorBuffer() { return this.data.nationColors; }
    get colorLUT() { return this.colorCache.colorLUT; }
    
    // 🚀 [Expert Fix] Missing getters from previous refactoring
    get terrainBuffer() { return this.data.terrain?.buffer; }
    get biomeBuffer() { return this.data.biomes?.buffer; }

    // --- Public Interface Delegates ---
    getSharedBuffers() { return this.data.getSharedBuffers(); }
    createBuffers(w, h) { 
        this.mapWidth = w; this.mapHeight = h;
        this.data.createBuffers(w, h); 
    }

    getIndex(x, y) {
        if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) return -1;
        return (Math.floor(y) * this.mapWidth) + Math.floor(x);
    }

    isValidIndex(idx) { return idx >= 0 && idx < (this.mapWidth * this.mapHeight); }

    isLand(idx) { return this.data.terrain?.isLand(idx); }
    isWater(idx) { return this.data.terrain?.isWater(idx); }
    isMountain(idx) { return this.data.terrain?.isMountain(idx); }

    isLandAt(x, y) {
        const idx = this.getIndex(x, y);
        return this.isValidIndex(idx) && this.isLand(idx);
    }

    isSoilAt(x, y) {
        const idx = this.getIndex(x, y);
        if (!this.isValidIndex(idx)) return false;
        
        // 🔍 [Expert Logic] 주변 3x3 영역을 검사하여 확실한 토양인지 확인
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkIdx = this.getIndex(x + dx * 2, y + dy * 2);
                if (!this.isValidIndex(checkIdx) || this.data.terrain?.getValue(checkIdx) !== TERRAIN_TYPES.SOIL) {
                    return false;
                }
            }
        }
        return true;
    }

    isNavigable(x, y) {
        const idx = this.getIndex(x, y);
        if (!this.isValidIndex(idx)) return false;
        if (this.isWater(idx) || this.isMountain(idx)) return false;
        if (this.data.occupancy[idx] >= 2) return false;
        return true;
    }

    setOccupancy(x, y, value) {
        const idx = this.getIndex(x, y);
        if (this.isValidIndex(idx)) this.data.occupancy[idx] = value;
    }

    getOccupancy(x, y) {
        const idx = this.getIndex(x, y);
        return this.isValidIndex(idx) ? this.data.occupancy[idx] : 0;
    }

    getBiomeAt(x, y) {
        const idx = this.getIndex(x, y);
        return this.isValidIndex(idx) ? this.data.biomes.getValue(idx) : -1;
    }

    getFertilityAt(x, y) {
        const idx = this.getIndex(x, y);
        return this.isValidIndex(idx) ? this.data.safeLoad(this.data.fertility, idx) : 0;
    }

    setFertility(x, y, value) {
        const idx = this.getIndex(x, y);
        if (this.isValidIndex(idx)) {
            const v = Math.max(0, Math.min(255, value));
            this.data.safeStore(this.data.fertility, idx, v);
            this.data.syncPackedPixel(idx);
        }
    }

    syncVillageColor(id, rgb) { this.data.villageColors[id] = rgb; }
    syncNationColor(id, rgb) { this.data.nationColors[id] = rgb; }

    getTerrainColor(idx, viewFlags, systems = {}) {
        return this.colorCache.getTerrainColor(idx, viewFlags, systems);
    }

    async generateProgressive(...args) {
        return this.generator.generateProgressive(...args);
    }

    // --- Utility Redirection ---
    safeAtomicsStore(b, i, v) { this.data.safeStore(b, i, v); }
    safeAtomicsLoad(b, i) { return this.data.safeLoad(b, i); }
    syncPackedPixel(idx) { this.data.syncPackedPixel(idx); }
}