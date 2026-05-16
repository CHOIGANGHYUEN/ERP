import { BIOMES, BIOME_NAMES_TO_IDS, TERRAIN_TYPES } from '../TerrainGen.js';

/**
 * 🏔️ TerrainGenerator
 * 지형 생성 파이프라인(프로그레시브 생성, 통계 수집 등)을 담당합니다.
 * TerrainGen.js에서 SRP에 따라 분리되었습니다.
 */
export default class TerrainGenerator {
    constructor(terrainGenFacade) {
        this.tg = terrainGenFacade;
    }

    async generateProgressive(mapWidth, mapHeight, engine, onProgress, outStats, waterPixels) {
        if (!this.tg.data.terrain) {
            this.tg.data.createBuffers(mapWidth, mapHeight);
        }

        if (engine.worker) {
            console.log("⚙️ [TerrainGenerator] Offloading to Worker...");
            return new Promise((resolve) => {
                const handleMessage = (e) => {
                    const { type, payload } = e.data;
                    if (type === 'TERRAIN_GEN_PROGRESS') {
                        if (onProgress) onProgress(payload.progress);
                    } else if (type === 'TERRAIN_GEN_COMPLETE') {
                        engine.worker.removeEventListener('message', handleMessage);
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

        // 메인 스레드 생성 폴백
        const seedAlt = Math.random() * 100;
        const seedHum = Math.random() * 100;
        const seedTemp = Math.random() * 100;

        const maxFertilityTable = new Uint8Array(256);
        BIOMES.forEach(b => { maxFertilityTable[b.id] = b.maxFertility || 0; });

        const landScaleInput = (engine.options && engine.options.landmassScale) || 100;
        const noiseFreq = 1.0 / (landScaleInput / 100);

        const steps = [16, 4, 1];
        const cm = engine.chunkManager;
        const cmBuffer = cm.buffer;
        const db = this.tg.data;

        for (const step of steps) {
            const batchSize = step === 1 ? 64 : 256; 

            for (let y = 0; y < mapHeight; y += step) {
                const ny = y / mapHeight;
                const cy = ny - 0.5;

                for (let x = 0; x < mapWidth; x += step) {
                    const idx = y * mapWidth + x;
                    const nx = x / mapWidth;
                    const cx = nx - 0.5;

                    let altitude = this.tg.noise.perlin(nx * 4 * noiseFreq + seedAlt, ny * 4 * noiseFreq + seedAlt) * 0.5 +
                                   this.tg.noise.perlin(nx * 8 * noiseFreq + seedAlt, ny * 8 * noiseFreq + seedAlt) * 0.25 +
                                   this.tg.noise.perlin(nx * 16 * noiseFreq + seedAlt, ny * 16 * noiseFreq + seedAlt) * 0.125;
                    
                    const distSq = cx * cx + cy * cy;
                    const mask = Math.max(0, 1.0 - Math.pow(distSq * 4.0, 0.75));
                    altitude *= mask;

                    const humidity = this.tg.noise.perlin(nx * 3 + seedHum, ny * 3 + seedHum) * 0.5 + 0.5;
                    const temperature = this.tg.noise.perlin(nx * 2 + seedTemp, ny * 2 + seedTemp) * 0.5 + 0.5;

                    const terrainId = this.determineTerrainType(altitude);
                    const biomeId = this.determineInitialBiome(terrainId, humidity, temperature);
                    const { soilFertility, waterQuality, mineralDensity } = this.calculateEnvironmentValues(terrainId, biomeId, altitude, humidity, temperature);
                    
                    const envValue = waterQuality > 0 ? waterQuality : mineralDensity;
                    const packedVal = terrainId | (biomeId << 8) | (soilFertility << 16) | (envValue << 24);
                    const altInt = Math.floor(altitude * 255);
                    const color = this.tg.colorCache.colorLUT[(terrainId << 8) | (biomeId << 4) | (soilFertility >> 4)];

                    if (step === 1) {
                        db.terrain.buffer[idx] = terrainId;
                        db.biomes.buffer[idx] = biomeId;
                        db.fertility[idx] = soilFertility;
                        db.waterQuality[idx] = waterQuality;
                        db.mineralDensity[idx] = mineralDensity;
                        db.altitude[idx] = altInt;
                        db.packed[idx] = packedVal;
                        cmBuffer[idx] = color;

                        if (outStats) {
                            outStats.totalFertility += soilFertility;
                            outStats.potentialFertility += maxFertilityTable[biomeId];
                        }
                        if (waterPixels && biomeId <= 3) {
                            waterPixels[engine.waterCount++] = idx;
                        }
                    } else {
                        for (let dy = 0; dy < step && y + dy < mapHeight; dy++) {
                            const rOff = (y + dy) * mapWidth + x;
                            const len = Math.min(step, mapWidth - x);
                            cmBuffer.subarray(rOff, rOff + len).fill(color);
                            db.terrain.buffer.subarray(rOff, rOff + len).fill(terrainId);
                            db.biomes.buffer.subarray(rOff, rOff + len).fill(biomeId);
                            db.fertility.subarray(rOff, rOff + len).fill(soilFertility);
                            db.waterQuality.subarray(rOff, rOff + len).fill(waterQuality);
                            db.mineralDensity.subarray(rOff, rOff + len).fill(mineralDensity);
                            db.packed.subarray(rOff, rOff + len).fill(packedVal);
                            db.altitude.subarray(rOff, rOff + len).fill(altInt);
                        }
                    }
                }

                if (y % batchSize === 0) {
                    if (onProgress) onProgress();
                    cm.markAllDirty(); 
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
            if (onProgress) onProgress();
            cm.markAllDirty();
            await new Promise(resolve => setTimeout(resolve, 20)); 
        }
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
        if (terrainId === TERRAIN_TYPES.LOW_MOUNTAIN) return BIOME_NAMES_TO_IDS.get('LOW_MOUNTAIN') || 8;
        if (terrainId === TERRAIN_TYPES.HIGH_MOUNTAIN) return BIOME_NAMES_TO_IDS.get('HIGH_MOUNTAIN') || 9;
        if (terrainId === TERRAIN_TYPES.SAND) return BIOME_NAMES_TO_IDS.get('SAND') || 4;
        if (terrainId === TERRAIN_TYPES.DEEP_OCEAN) return BIOME_NAMES_TO_IDS.get('DEEP_OCEAN') || 0;
        if (terrainId === TERRAIN_TYPES.OCEAN) return BIOME_NAMES_TO_IDS.get('OCEAN') || 1;
        if (terrainId === TERRAIN_TYPES.LAKE) return BIOME_NAMES_TO_IDS.get('LAKE') || 2;
        if (terrainId === TERRAIN_TYPES.RIVER) return BIOME_NAMES_TO_IDS.get('RIVER') || 3;
        
        if (humidity > 0.7 && temperature > 0.6) return BIOME_NAMES_TO_IDS.get('JUNGLE') || 7;
        if (humidity > 0.4) return BIOME_NAMES_TO_IDS.get('GRASS') || 6;
        return BIOME_NAMES_TO_IDS.get('DIRT') || 5;
    }

    calculateEnvironmentValues(terrainId, biomeId, altitude, humidity, temperature) {
        const isFertile = [TERRAIN_TYPES.SAND, TERRAIN_TYPES.SOIL].includes(terrainId);
        const isWater = [0, 1, 2, 3].includes(terrainId);
        const isMountain = [6, 7].includes(terrainId);
        return {
            soilFertility: isFertile ? Math.floor(25 + Math.random() * 200) : 0,
            waterQuality: isWater ? 200 : 0,
            mineralDensity: isMountain ? 230 : 0
        };
    }

    collectFinalStats(outStats, waterPixels, engine) {
        if (!outStats && !waterPixels) return;
        const mapSize = this.tg.mapWidth * this.tg.mapHeight;
        const db = this.tg.data;
        const maxFertilityTable = new Uint8Array(256);
        BIOMES.forEach(b => { maxFertilityTable[b.id] = b.maxFertility || 0; });

        for (let i = 0; i < mapSize; i++) {
            const bId = db.safeLoad(db.biomes.buffer, i);
            const fert = db.safeLoad(db.fertility, i);
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
