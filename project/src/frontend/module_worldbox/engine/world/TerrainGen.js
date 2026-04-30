import SoilFertility from '../components/environment/SoilFertility.js';
import WaterQuality from '../components/environment/WaterQuality.js';
import MineralDensity from '../components/environment/MineralDensity.js';
import Transform from '../components/motion/Transform.js';
// 참고: Tile 컴포넌트와 TILE_TYPES 상수는 프로젝트에 맞게 정의되어 있다고 가정합니다.
// Import biome data from biomes.json
import biomesData from '../config/biomes.json';

// import Tile from '../components/world/Tile.js';
// import { TILE_TYPES } from '../config/constants.js';

/**
 * 지형 생성 로직을 담당하는 클래스.
 * Perlin Noise 등을 사용하여 고도, 온도, 습도 데이터를 계산하고
 * 타일 엔티티에 환경 컴포넌트를 할당합니다.
 */

export const BIOMES = biomesData.biomes;
export const BIOME_PROPERTIES_MAP = new Map(BIOMES.map(biome => [biome.id, biome]));
export const BIOME_NAMES_TO_IDS = new Map(BIOMES.map(biome => [biome.name, biome.id]));
export default class TerrainGen {
    mapWidth = 0;
    mapHeight = 0;
    biomeBuffer = null; // Uint32Array to store biome IDs
    fertilityBuffer = null; // Uint8Array to store fertility values (0-100) ⚡ [Step 2]
    waterQualityBuffer = null;
    mineralDensityBuffer = null;
    constructor(entityManager) {
        this.entityManager = entityManager;
    }

    /**
     * 월드 좌표와 환경 값에 따라 타일 엔티티를 생성하고 모든 관련 컴포넌트를 할당합니다.
     * 이 메서드는 ChunkManager 등에서 호출되어 월드를 구성합니다.
     *
     * @param {number} x 타일 X 좌표
     * @param {number} y 타일 Y 좌표
     * @param {number} altitude 타일의 고도 (0.0 ~ 1.0)
     * @param {number} humidity 타일의 습도 (0.0 ~ 1.0)
     * @param {number} temperature 타일의 온도 (0.0 ~ 1.0)
     * @returns {object} 생성된 타일 엔티티
     */
    generate(mapWidth, mapHeight) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.biomeBuffer = new Uint32Array(mapWidth * mapHeight);
        this.fertilityBuffer = new Uint8Array(mapWidth * mapHeight); // ⚡ Uint8 고속 배열
        this.waterQualityBuffer = new Float32Array(mapWidth * mapHeight);
        this.mineralDensityBuffer = new Float32Array(mapWidth * mapHeight);

        const seedAlt = Math.random() * 100;
        const seedHum = Math.random() * 100;
        const seedTemp = Math.random() * 100;

        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const idx = y * mapWidth + x;

                const nx = x / mapWidth;
                const ny = y / mapHeight;

                // 1. 프랙탈 파동 중첩으로 부드러운 지형 수치 생성
                let altitude = this._getFractalNoise(nx, ny, seedAlt);
                const humidity = this._getFractalNoise(nx, ny, seedHum);
                const temperature = this._getFractalNoise(nx, ny, seedTemp);

                // 2. 대륙(섬) 마스크 적용: 맵 중앙은 높고 가장자리는 바다가 되도록 깎아냄
                const cx = nx - 0.5;
                const cy = ny - 0.5;
                const dist = Math.sqrt(cx * cx + cy * cy) * 2.0; // 0(중앙) ~ 1.4(구석)
                const mask = Math.max(0, 1.0 - Math.pow(dist, 1.5));
                altitude = altitude * mask;

                // Call the method that creates the entity and updates the internal buffers
                this.generateTileAndBuffers(x, y, altitude, humidity, temperature, idx);
            }
        }
    }

    _getFractalNoise(nx, ny, seed) {
        // 🚀 High-Res Fractal: Adding a 4th octave for extreme coastal detail
        let e = 1.0 * this._noise(nx, ny, 6, seed)
            + 0.5 * this._noise(nx, ny, 12, seed + 10)
            + 0.25 * this._noise(nx, ny, 24, seed + 20)
            + 0.125 * this._noise(nx, ny, 48, seed + 30); // 🌊 Micro-detail layer
        return e / 1.875;
    }


    _noise(nx, ny, freq, seed) {
        const x = nx * freq;
        const y = ny * freq;
        return (Math.sin(x + seed) + Math.cos(y + seed) + Math.sin((x + y) * 1.4 + seed) + Math.cos((x - y) * 1.4 + seed)) / 4 + 0.5;
    }

    // Renamed and modified generateTile to generateTileAndBuffers
    generateTileAndBuffers(x, y, altitude, humidity, temperature, idx) {
        const biomeId = this.determineTileType(altitude, humidity, temperature);

        const { soilFertility, waterQuality, mineralDensity } = this.calculateEnvironmentValues(biomeId, altitude, humidity, temperature);

        // [최적화] 1px 단위 시뮬레이션에서는 1,000,000개의 타일 엔티티를 생성하면 메모리 오버플로우가 발생하므로
        // ECS의 컴포넌트 객체 할당 대신 메모리 연속성이 보장되는 버퍼(Buffer) 배열 데이터로 상태를 관리합니다.
        this.biomeBuffer[idx] = biomeId;
        this.fertilityBuffer[idx] = soilFertility;
        this.waterQualityBuffer[idx] = waterQuality;
        this.mineralDensityBuffer[idx] = mineralDensity;
    }

    /**
     * 환경 값에 따라 타일의 기본 타입을 결정합니다. (프로젝트에 맞게 확장 필요)
     * @private
     */
    determineTileType(altitude, humidity, temperature) {
        const ocean = BIOME_NAMES_TO_IDS.get('OCEAN') || 1;
        const deepOcean = BIOME_NAMES_TO_IDS.get('DEEP_OCEAN') || 0;
        const sand = BIOME_NAMES_TO_IDS.get('SAND') || 4;
        const dirt = BIOME_NAMES_TO_IDS.get('DIRT') || 5;
        const grass = BIOME_NAMES_TO_IDS.get('GRASS') || 6;
        const jungle = BIOME_NAMES_TO_IDS.get('JUNGLE') || 7;
        const lowMnt = BIOME_NAMES_TO_IDS.get('LOW_MOUNTAIN') || 8;
        const highMnt = BIOME_NAMES_TO_IDS.get('HIGH_MOUNTAIN') || 9;

        // 고도 기반 1차 판별
        if (altitude < 0.25) return deepOcean;
        if (altitude < 0.40) return ocean;
        if (altitude < 0.45) return sand; // 해변가
        if (altitude > 0.80) return highMnt;
        if (altitude > 0.65) return lowMnt;

        // 나머지는 모두 기본 흙(DIRT)으로 시작하여, 사용자가 씨앗을 뿌려 확산되도록 캔버스 제공
        return dirt;
    }

    /**
     * @param {number} biomeId 타일의 바이옴 ID
     * 타일 타입과 환경 값에 따라 3가지 기반 수치를 계산합니다.
     * 이 로직은 biome_resources_blueprint.md 명세를 따릅니다.
     * @private
     */
    calculateEnvironmentValues(biomeId, altitude, humidity, temperature) {
        let soilFertility = 0;
        let waterQuality = 0;
        let mineralDensity = 0;

        const biome = BIOME_PROPERTIES_MAP.get(biomeId);
        if (!biome) {
            console.warn(`Unknown biome ID: ${biomeId}. Using default environment values.`); // biomeId is now correctly defined
            return { soilFertility, waterQuality, mineralDensity };
        }

        // Start with base values from biomes.json
        soilFertility = biome.baseSoilFertility; // Changed from tileTypeName to biomeId
        waterQuality = biome.waterQuality;
        mineralDensity = biome.mineralDensity;

        // Apply dynamic influences based on altitude, humidity, temperature
        // These are examples and can be refined based on game design.

        // 육상 지형: 비옥도 계산 (DIRT:5, GRASS:6, JUNGLE:7)
        if ([5, 6, 7].includes(biomeId)) {
            // 흙(DIRT)의 경우에도 환경 요인에 따라 잠재적 비옥도를 높게 가지도록 보정
            let base = biomeId === 5 ? 0.8 : (biome.baseSoilFertility || 0.0);
            const altitudeInfluence = Math.max(0, 1 - Math.pow(Math.abs(altitude - 0.55) * 2.5, 2));
            const humidityInfluence = Math.max(0, 1 - Math.pow(Math.abs(humidity - 0.6) * 2.5, 2));
            soilFertility = base * altitudeInfluence * humidityInfluence;


            // Specific conditions (e.g., very low altitude/high altitude, very dry)
            if (altitude < 0.15) { // Near water/very low altitude
                soilFertility *= 0.1; // Significantly reduced
            } else if (altitude > 0.85) { // High altitude
                soilFertility *= 0.3; // Reduced
            }
            if (humidity < 0.2) { // Very dry
                soilFertility *= 0.1; // Significantly reduced
            }
        }

        // 수생 지형: 수질 계산 (OCEAN 등)
        if ([0, 1, 2, 3].includes(biomeId)) { // DEEP_OCEAN, OCEAN, LAKE, RIVER IDs
            // Optimal water quality around moderate temperatures (0.5)
            const temperatureInfluence = 1 - Math.abs(temperature - 0.5) * 2; // Max at 0.5, drops off
            waterQuality *= Math.max(0, temperatureInfluence);

            // Additional factors for specific water types
            if (biomeId === 0) { // DEEP_OCEAN
                waterQuality *= 0.8; // Deep ocean might have slightly lower quality due to lack of light/flow
            } else if (biomeId === 3) { // RIVER
                waterQuality *= (0.9 + (altitude * 0.1)); // Rivers might be cleaner at higher altitudes
            }
        } else {
            waterQuality = 0; // Land tiles have no water quality
        }

        // 산악 지형: 광맥 밀도 계산 (MOUNTAIN 등)
        if ([8, 9].includes(biomeId)) { // LOW_MOUNTAIN, HIGH_MOUNTAIN IDs
            if ([8, 9].includes(biomeId)) { // LOW_MOUNTAIN, HIGH_MOUNTAIN IDs
                const altitudeFactor = Math.pow(altitude, 2); // Exponential increase with altitude
                mineralDensity *= altitudeFactor;

                // High mountains might have richer deposits
                if (biomeId === 9) { // HIGH_MOUNTAIN
                    mineralDensity *= 1.2; // 20% bonus for high mountains
                }
            }
        }

        const isLand = [5, 6, 7].includes(biomeId);

        return {
            // 🎲 [Step 2] 0~100 사이의 정수 비옥도 할당
            soilFertility: isLand ? Math.floor(10 + Math.random() * 90) : 0,
            waterQuality: Math.max(0, Math.min(1, waterQuality)),
            mineralDensity: Math.max(0, Math.min(1, mineralDensity)),
        };


    }

    /**
     * 특정 타일의 색상을 결정합니다. ChunkManager에서 호출됩니다.
     * @param {number} idx 타일의 인덱스
     * @param {object} viewFlags 현재 활성화된 뷰 플래그 (예: { fertility: true })
     * @returns {number} RGB 색상 (0xRRGGBB)
     */
    getTerrainColor(idx, viewFlags) {
        const biomeId = this.biomeBuffer[idx];
        const fertility = this.fertilityBuffer[idx];
        const biome = BIOME_PROPERTIES_MAP.get(biomeId);

        if (!biome) {
            console.warn(`getTerrainColor: Unknown biome ID: ${biomeId} at index ${idx}.`);
            return 0x000000; // Default to black
        }

        let r, g, b;

        if (viewFlags.fertility) {
            const isLand = [4, 5, 6, 7].includes(biomeId);
            if (!isLand) return 0x000000;

            // 👾 [Step 2] Uint8 (0-100) 값 직접 사용
            const dotValue = fertility; 

            if (dotValue === 0) return 0x050000;

            // 🎨 촘촘한 10단계 세분화 팔레트 (Every 10%)
            if (dotValue < 10) { r = 130; g = 20; b = 20; }       // Very Low (0.1)
            else if (dotValue < 20) { r = 180; g = 30; b = 30; }  // Low
            else if (dotValue < 30) { r = 255; g = 80; b = 0; }   // Low-Mid
            else if (dotValue < 40) { r = 255; g = 130; b = 0; }  // Mid-Low
            else if (dotValue < 50) { r = 255; g = 180; b = 0; }  // Mid
            else if (dotValue < 60) { r = 255; g = 220; b = 0; }  // Mid-High
            else if (dotValue < 70) { r = 210; g = 255; b = 0; }  // High-Mid
            else if (dotValue < 80) { r = 150; g = 255; b = 30; } // High
            else if (dotValue < 90) { r = 50; g = 255; b = 70; }  // Very High
            else { r = 0; g = 255; b = 100; }                    // Max (1.0)
            
            return (r << 16) | (g << 8) | b;
        } else if (viewFlags.water) {
            const wq = this.waterQualityBuffer[idx];
            const isWater = [0, 1, 2, 3].includes(biomeId);
            if (!isWater) return 0x111111;
            const level = Math.floor(wq * 4);
            if (level === 0) { r = 21; g = 101; b = 192; }
            else if (level === 1) { r = 30; g = 136; b = 229; }
            else if (level === 2) { r = 66; g = 165; b = 245; }
            else { r = 144; g = 202; b = 249; }
            return (r << 16) | (g << 8) | b;
        } else if (viewFlags.mineral) {
            const md = this.mineralDensityBuffer[idx];
            const isMountain = [8, 9].includes(biomeId);
            if (!isMountain) return 0x111111;
            const level = Math.floor(md * 4);
            if (level === 0) { r = 66; g = 66; b = 66; }
            else if (level === 1) { r = 117; g = 117; b = 117; }
            else if (level === 2) { r = 189; g = 189; b = 189; }
            else { r = 255; g = 255; b = 255; }
            return (r << 16) | (g << 8) | b;
        } else {
            // 🌿 [Step 2] 0-100 값을 0-1 비율로 변환하여 보간
            const fRatio = fertility / 100;
            const colorLow = biome.colorLow || [100, 100, 100];
            const colorHigh = biome.colorHigh || [200, 200, 200];

            r = Math.floor(colorLow[0] + (colorHigh[0] - colorLow[0]) * fRatio);
            g = Math.floor(colorLow[1] + (colorHigh[1] - colorLow[1]) * fRatio);
            b = Math.floor(colorLow[2] + (colorHigh[2] - colorLow[2]) * fRatio);

            return (r << 16) | (g << 8) | b;
        }
    }

}