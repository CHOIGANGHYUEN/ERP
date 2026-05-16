import { TerrainLayer, BiomeLayer } from '../WorldLayers.js';

/**
 * 📦 TerrainDataBuffers
 * SharedArrayBuffer 기반의 지형, 바이옴, 환경 데이터를 보관하고 관리합니다.
 * TerrainGen.js에서 SRP에 따라 분리되었습니다.
 */
export default class TerrainDataBuffers {
    constructor(terrainGenFacade) {
        this.tg = terrainGenFacade;
        
        // 레이어 인스턴스
        this.terrain = null;
        this.biomes = null;
        
        // 환경 수치 레이어
        this.fertility = null; 
        this.waterQuality = null;
        this.mineralDensity = null;
        this.occupancy = null;
        this.territory = null; 
        this.altitude = null;
        this.packed = null;

        // 마을/국가 색상 버퍼
        this.villageColors = new Uint32Array(new SharedArrayBuffer(2048 * 4));
        this.nationColors = new Uint32Array(new SharedArrayBuffer(2048 * 4));
        this.villageColors.fill(0xFFFFFFFF);
        this.nationColors.fill(0xFFFFFFFF);
    }

    createBuffers(mapWidth, mapHeight) {
        this.terrain = new TerrainLayer(mapWidth, mapHeight);
        this.biomes = new BiomeLayer(mapWidth, mapHeight);
        
        this.fertility = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.waterQuality = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.mineralDensity = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.occupancy = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.territory = new Uint16Array(new SharedArrayBuffer(mapWidth * mapHeight * 2));
        this.altitude = new Uint8Array(new SharedArrayBuffer(mapWidth * mapHeight));
        this.packed = new Uint32Array(new SharedArrayBuffer(mapWidth * mapHeight * 4));
    }

    getSharedBuffers() {
        return {
            terrain: this.terrain.sharedBuffer,
            biomes: this.biomes.sharedBuffer,
            fertility: this.fertility.buffer,
            waterQuality: this.waterQuality.buffer,
            mineralDensity: this.mineralDensity.buffer,
            occupancy: this.occupancy.buffer,
            territory: this.territory.buffer,
            altitude: this.altitude.buffer,
            packed: this.packed.buffer,
            villageColors: this.villageColors.buffer,
            nationColors: this.nationColors.buffer,
            renderBuffer: this.tg.engine.chunkManager.buffer.buffer,
            colorLUT: this.tg.colorCache.colorLUT.buffer,
            mapWidth: this.tg.mapWidth,
            mapHeight: this.tg.mapHeight
        };
    }

    /** 🛡️ Atomics Helpers */
    safeStore(buffer, idx, value) {
        if (buffer && buffer.buffer instanceof SharedArrayBuffer) {
            Atomics.store(buffer, idx, value);
        } else if (buffer) {
            buffer[idx] = value;
        }
    }

    safeLoad(buffer, idx) {
        if (buffer && buffer.buffer instanceof SharedArrayBuffer) {
            return Atomics.load(buffer, idx);
        } else if (buffer) {
            return buffer[idx];
        }
        return 0;
    }

    syncPackedPixel(idx) {
        if (!this.packed) return;
        const t = this.terrain.buffer[idx];
        const b = this.biomes.buffer[idx];
        const f = this.fertility[idx];
        const w = Math.max(this.waterQuality[idx], this.mineralDensity[idx]);
        
        const packedVal = t | (b << 8) | (f << 16) | (w << 24);
        this.safeStore(this.packed, idx, packedVal);
    }
}
