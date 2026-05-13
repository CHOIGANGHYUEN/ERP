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
    
    // 환경 수치 레이어
    fertilityBuffer = null; 
    waterQualityBuffer = null;
    mineralDensityBuffer = null;
    occupancyBuffer = null;
    territoryBuffer = null; 
    altitudeBuffer = null; // 🏔️ 고도 데이터 버퍼 추가
    // 🏘️ [Performance Optimization] 마을/국가 색상 고속 조회를 위한 버퍼
    villageColorBuffer = new Uint32Array(2048); 
    nationColorBuffer = new Uint32Array(2048);

    constructor(engine) {
        this.engine = engine;
        this.entityManager = engine?.entityManager;
        // 기본값(흰색/투명 등)으로 초기화
        this.villageColorBuffer = new Uint32Array(new SharedArrayBuffer(2048 * 4));
        this.nationColorBuffer = new Uint32Array(new SharedArrayBuffer(2048 * 4));
        this.villageColorBuffer.fill(0xFFFFFFFF);
        this.nationColorBuffer.fill(0xFFFFFFFF);
    }

    /** 🚀 [Expert Optimization] 워커로 전송할 공유 버퍼 데이터 모음 */
    getSharedBuffers() {
        return {
            terrain: this.terrain.sharedBuffer,
            biomes: this.biomes.sharedBuffer,
            fertility: this.fertilityBuffer.buffer,
            waterQuality: this.waterQualityBuffer.buffer,
            mineralDensity: this.mineralDensityBuffer.buffer,
            occupancy: this.occupancyBuffer.buffer,
            territory: this.territoryBuffer.buffer,
            altitude: this.altitudeBuffer.buffer,
            packed: this.packedBuffer.buffer,
            villageColors: this.villageColorBuffer.buffer,
            nationColors: this.nationColorBuffer.buffer,
            renderBuffer: this.engine.chunkManager.buffer.buffer, // 🎨 렌더 캐시 버퍼 추가
            colorLUT: this.colorLUT.buffer, // 🎨 컬러 테이블 추가
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight
        };
    }

    // --- Interface Redirection ---
    // 외부 시스템은 여전히 TerrainGen을 통하지만, 내부적으로는 각 레이어가 처리함
    isValidIndex(idx) { return this.terrain && this.terrain.isValid(idx); }
    getIndex(x, y) { 
        // 🚀 [Expert Fix] NaN, 음수 및 경계 검증 강화 (Wrap-around 버그 방지)
        if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) return -1;
        return (Math.floor(y) * this.mapWidth) + Math.floor(x); 
    }
    
    /** 🛡️ [Expert Logic] SharedArrayBuffer 및 Atomics 환경 호환성 레이어 */
    safeAtomicsStore(buffer, idx, value) {
        if (buffer && buffer.buffer instanceof SharedArrayBuffer) {
            Atomics.store(buffer, idx, value);
        } else if (buffer) {
            buffer[idx] = value;
        }
    }

    safeAtomicsLoad(buffer, idx) {
        if (buffer && buffer.buffer instanceof SharedArrayBuffer) {
            return Atomics.load(buffer, idx);
        } else if (buffer) {
            return buffer[idx];
        }
        return 0;
    }

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

    getFertilityAt(x, y) {
        const idx = this.getIndex(x, y);
        if (!this.isValidIndex(idx)) return 0;
        return this.safeAtomicsLoad(this.fertilityBuffer, idx);
    }

    /** 🧪 비옥도 설정 (외부 시스템 연동용) */
    setFertility(x, y, value) {
        const idx = this.getIndex(x, y);
        if (this.isValidIndex(idx)) {
            const v = Math.max(0, Math.min(255, value));
            // 🛡️ [Environment Compatibility] Atomics 폴백 적용
            this.safeAtomicsStore(this.fertilityBuffer, idx, v);
            this.syncPackedPixel(idx);
        }
    }

    /** 🎨 [Sync] 외부 시스템에서 마을/국가 색상 동기화 */
    syncVillageColor(id, rgb) {
        if (id >= 0 && id < this.villageColorBuffer.length) {
            this.villageColorBuffer[id] = rgb;
        }
    }

    syncNationColor(id, rgb) {
        if (id >= 0 && id < this.nationColorBuffer.length) {
            this.nationColorBuffer[id] = rgb;
        }
    }

    /** 🚀 [Expert Optimization] 개별 버퍼 변경 시 팩킹 버퍼 동기화 */
    /** 🚀 [Expert Optimization] 개별 버퍼 변경 시 팩킹 버퍼 동기화 */
    syncPackedPixel(idx) {
        if (!this.packedBuffer) return;
        // 🚀 [Optimization] Avoid safeAtomicsLoad for frequent internal syncs
        const t = this.terrain.buffer[idx];
        const b = this.biomes.buffer[idx];
        const f = this.fertilityBuffer[idx];
        const w = Math.max(this.waterQualityBuffer[idx], this.mineralDensityBuffer[idx]);
        
        const packedVal = t | (b << 8) | (f << 16) | (w << 24);
        this.safeAtomicsStore(this.packedBuffer, idx, packedVal);
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
    colorLUT = null;

    _initColorLUT() {
        if (this.colorLUT) return;
        // 8 (terrain) * 16 (biomes) * 16 (fertility) = 2048 entries
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
                    
                    // ABGR format for Canvas ImageData
                    this.colorLUT[(t << 8) | (b << 4) | fIdx] = (255 << 24) | (bVal << 16) | (g << 8) | r;
                }
            }
        }
    }

    createBuffers(mapWidth, mapHeight) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        
        this.terrain = new TerrainLayer(mapWidth, mapHeight);
        this.biomes = new BiomeLayer(mapWidth, mapHeight);
        
        this.fertilityBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.waterQualityBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.mineralDensityBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.occupancyBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.territoryBuffer = new Uint16Array(new SharedArrayBuffer(mapWidth * mapHeight * 2));
        this.altitudeBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.packedBuffer = new Uint32Array(new SharedArrayBuffer(mapWidth * mapHeight * 4));

        this._initColorLUT();
    }

    async generateProgressive(mapWidth, mapHeight, engine, onProgress, outStats, waterPixels) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        
        // 1. 버퍼 초기화 (이미 생성되지 않았다면 수행)
        if (!this.terrain) {
            this.createBuffers(mapWidth, mapHeight);
        }

        // 🚀 [Expert Optimization] 워커가 가용하다면 워커로 위임
        if (engine.worker) {
            console.log("⚙️ [TerrainGen] Offloading generation to Worker...");
            return new Promise((resolve) => {
                const handleMessage = (e) => {
                    const { type, payload } = e.data;
                    if (type === 'TERRAIN_GEN_PROGRESS') {
                        if (onProgress) onProgress(payload.progress);
                    } else if (type === 'TERRAIN_GEN_COMPLETE') {
                        engine.worker.removeEventListener('message', handleMessage);
                        // 통계 계산 (워커 완료 후 한 번에 수행)
                        this.collectFinalStats(outStats, waterPixels, engine);
                        resolve();
                    }
                };
                engine.worker.addEventListener('message', handleMessage);
                
                engine.worker.postMessage({
                    type: 'GENERATE_TERRAIN',
                    payload: {
                        width: mapWidth,
                        height: mapHeight,
                        seedAlt: Math.random() * 100,
                        seedHum: Math.random() * 100,
                        seedTemp: Math.random() * 100,
                        landmassScale: (engine.options && engine.options.landmassScale) || 100
                    }
                });
            });
        }

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

        // 🏔️ [Expert Design] 지형 스케일 계산 (기본 100% -> scale 1.0)
        // 사용자가 '육지 크기'를 키우면(예: 200%), 노이즈 주파수는 낮아져야(예: 0.5) 육지가 커집니다.
        const landScaleInput = (engine.options && engine.options.landmassScale) || 100;
        const noiseFreq = 1.0 / (landScaleInput / 100);

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

                    // 🏎️ [Ultra-Fast Perlin] Trig 제거 및 동적 스케일 적용
                    let altitude = this._perlin(nx * 4 * noiseFreq + seedAlt, ny * 4 * noiseFreq + seedAlt) * 0.5 +
                                   this._perlin(nx * 8 * noiseFreq + seedAlt, ny * 8 * noiseFreq + seedAlt) * 0.25 +
                                   this._perlin(nx * 16 * noiseFreq + seedAlt, ny * 16 * noiseFreq + seedAlt) * 0.125;
                    
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
                    const wq = (terrainId <= 1) ? 200 : 0;
                    const md = (terrainId >= 6) ? 230 : 0;
                    
                    fertBuf[idx] = fert;
                    wqBuf[idx] = wq;
                    mdBuf[idx] = md;
                    this.altitudeBuffer[idx] = Math.floor(altitude * 255);

                    // 🚀 [Expert Packing] 지형|바이옴|비옥도|수질(또는 광물) 데이터를 하나로 압축
                    const envValue = wq > 0 ? wq : md;
                    this.packedBuffer[idx] = terrainId | (biomeId << 8) | (fert << 16) | (envValue << 24);

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
                        terrainBuf[idx] = terrainId;
                        biomeBuf[idx] = biomeId;
                        fertBuf[idx] = fert;
                        wqBuf[idx] = wq;
                        mdBuf[idx] = md;
                        this.packedBuffer[idx] = terrainId | (biomeId << 8) | (fert << 16) | (envValue << 24);
                        this.altitudeBuffer[idx] = Math.floor(altitude * 255);
                    } else {
                        const altInt = Math.floor(altitude * 255);
                        const packedVal = terrainId | (biomeId << 8) | (fert << 16) | (envValue << 24);

                        for (let dy = 0; dy < step && y + dy < mapHeight; dy++) {
                            const rOff = (y + dy) * mapWidth + x;
                            const len = Math.min(step, mapWidth - x);
                            
                            // 🏎️ [Expert Fill] Row-based bulk assignment
                            cmBuffer.subarray(rOff, rOff + len).fill(color);
                            terrainBuf.subarray(rOff, rOff + len).fill(terrainId);
                            biomeBuf.subarray(rOff, rOff + len).fill(biomeId);
                            fertBuf.subarray(rOff, rOff + len).fill(fert);
                            wqBuf.subarray(rOff, rOff + len).fill(wq);
                            mdBuf.subarray(rOff, rOff + len).fill(md);
                            this.packedBuffer.subarray(rOff, rOff + len).fill(packedVal);
                            this.altitudeBuffer.subarray(rOff, rOff + len).fill(altInt);
                        }
                    }
                }


                if (y % batchSize === 0) {
                    if (onProgress) onProgress();
                    // 🚀 [Tiled Optimization] 한 배치가 끝날 때만 한꺼번에 Dirty 마킹하여 렌더링 성능 확보
                    cm.markAllDirty(); 
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
            if (onProgress) onProgress();
            cm.markAllDirty();
            await new Promise(resolve => setTimeout(resolve, 20)); 
        }
    }

    generate(mapWidth, mapHeight) {
        // 동기식 생성 로직 (레거시 지원 및 즉시 생성이 필요한 경우)
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        
        this.terrain = new TerrainLayer(mapWidth, mapHeight);
        this.biomes = new BiomeLayer(mapWidth, mapHeight);
        this.fertilityBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.waterQualityBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.mineralDensityBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.occupancyBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.territoryBuffer = new Uint16Array(new SharedArrayBuffer(mapWidth * mapHeight * 2));
        this.altitudeBuffer = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.packedBuffer = new Uint32Array(new SharedArrayBuffer(mapWidth * mapHeight * 4));

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
        this.altitudeBuffer[idx] = Math.floor(altitude * 255);

        // 🚀 [Expert Optimization] 팩킹 버퍼 동기화
        this.syncPackedPixel(idx);
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

    getTerrainColor(idx, viewFlags, systems = {}) {
        // 🚀 [Expert Optimization] 여러 버퍼를 순회하는 대신 팩킹된 단일 버퍼에서 비트 연산으로 추출
        const val = this.packedBuffer[idx];
        if (val === undefined) return 0xFF000000;

        const terrainId = val & 0xFF;
        const biomeId = (val >> 8) & 0xFF;
        const fertility = (val >> 16) & 0xFF;
        
        let r = 0, g = 0, b = 0;
        
        // 🏘️ [Village/Nation View] 고속 버퍼 조회를 통한 영토 렌더링 (Map.get 제거)
        const villageId = this.territoryBuffer[idx];
        if (villageId > 0) {
            if (viewFlags.VILLAGETILE) {
                const vColor = this.villageColorBuffer[villageId];
                if (vColor !== 0xFFFFFFFF) return vColor;
            } else if (viewFlags.NATIONTILE) {
                const nColor = this.nationColorBuffer[villageId];
                if (nColor !== 0xFFFFFFFF) return nColor;
            }
        }

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
            const wq = (val >> 24) & 0xFF;
            const level = wq >> 6; // 0-255를 4단계(0-3)로 고속 변환
            const shades = [0x1565C0, 0x1E88E5, 0x42A5F5, 0x90CAF9];
            return shades[Math.min(3, level)];
        }

        // 3. 💎 광물 밀도 뷰 (Mineral Density View)
        if (viewFlags.mineral) {
            if (!this.terrain.isMountain(idx)) return 0x111111;
            const md = (val >> 24) & 0xFF;
            const level = md >> 6; // 0-255를 4단계(0-3)로 고속 변환
            const shades = [0x424242, 0x757575, 0xBDBDBD, 0xFFFFFF];
            return shades[Math.min(3, level)];
        }

        return (r << 16) | (g << 8) | b;
    }

    /** 📊 [Expert Logic] 워커 완료 후 최종 통계 및 수역 데이터 수집 */
    collectFinalStats(outStats, waterPixels, engine) {
        if (!outStats && !waterPixels) return;
        
        const mapSize = this.mapWidth * this.mapHeight;
        const biomeBuf = this.biomes.buffer;
        const fertBuf = this.fertilityBuffer;
        
        const maxFertilityTable = new Uint8Array(256);
        BIOMES.forEach(b => {
            maxFertilityTable[b.id] = b.maxFertility || 0;
        });

        for (let i = 0; i < mapSize; i++) {
            const bId = this.safeAtomicsLoad(biomeBuf, i);
            const fert = this.safeAtomicsLoad(fertBuf, i);
            
            if (outStats) {
                outStats.totalFertility += fert;
                outStats.potentialFertility += maxFertilityTable[bId];
            }
            if (waterPixels && bId <= 3) {
                waterPixels[engine.waterCount++] = i;
            }
        }
    }
}