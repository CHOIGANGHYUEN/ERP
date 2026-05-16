import { BIOME_NAMES_TO_IDS } from '../../../world/TerrainGen.js';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🌌 WorldInitializer
 * 게임 로드 시 1회만 동작하는 초기 세계 생성(Nature, Mineral, Human 스폰)을 담당합니다.
 * SpawnerSystem.js에서 SRP에 따라 분리되었습니다.
 */
export default class WorldInitializer {
    constructor(spawnerSystem) {
        this.ss = spawnerSystem;
        this.engine = spawnerSystem.engine;
        this.terrainGen = spawnerSystem.terrainGen;
    }

    initializeWorld() {
        const options = this.engine.options || {};
        const natureMult = (options.natureDensity ?? 0) / 100;
        const mineralMult = (options.mineralDensity ?? 0) / 100;
        const animalMult = (options.animalDensity ?? 0) / 100;
        const humanCount = options.humanCount ?? 0;

        const w = this.terrainGen.mapWidth;
        const h = this.terrainGen.mapHeight;

        // 🚀 나무 점유 맵 초기화
        const gridW = Math.ceil(w / 16);
        const gridH = Math.ceil(h / 16);
        this.ss.treeOccupancyBuffer = new Uint8Array(gridW * gridH);
        this.ss.treeOccupancyGridW = gridW;
        this.ss.treeOccupancyGridH = gridH;

        console.log(`🌌 [Initializer] Generating Nature (${natureMult}x)...`);

        // 1. 🌿 식물 및 나무 스폰
        const natureTarget = Math.floor((w * h / 500) * natureMult);
        for (let i = 0; i < natureTarget; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const idx = this.terrainGen.getIndex(x, y);
            if (idx === -1) continue;

            const fertility = this.terrainGen.fertilityBuffer[idx] / 100;
            if (fertility > 0.3 && !this.terrainGen.isWater(idx)) {
                const biomeId = this.terrainGen.biomeBuffer[idx];
                const pool = this.ss.biomeSpawnTable.get(biomeId) || ['grass'];
                const resId = pool[Math.floor(Math.random() * pool.length)];
                this.ss.assembler.spawnGenericResource(x, y, resId, false, true);
            }
        }

        // 2. 💎 광석 스폰
        const mineralTarget = Math.floor((w * h / 2000) * mineralMult);
        const minerals = ['stone', 'iron', 'gold', 'coal'];
        for (let i = 0; i < mineralTarget; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const idx = this.terrainGen.getIndex(x, y);
            if (this.terrainGen.mineralDensityBuffer[idx] > 100 && !this.terrainGen.isWater(idx)) {
                const resId = minerals[Math.floor(Math.random() * minerals.length)];
                this.ss.assembler.spawnGenericResource(x, y, resId, false, true);
            }
        }

        // 3. 🐑 동물 스폰
        const animalTarget = Math.floor(50 * animalMult);
        const animals = ['sheep', 'rabbit', 'wild_dog', 'wolf'];
        for (let i = 0; i < animalTarget; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const idx = this.terrainGen.getIndex(x, y);
            if (!this.terrainGen.isWater(idx)) {
                const type = animals[Math.floor(Math.random() * animals.length)];
                this.ss.assembler.spawnEntity({ type, x, y });
            }
        }

        // 4. 🧍 인간 개척민 스폰
        for (let i = 0; i < humanCount; i++) {
            const x = (w * 0.4) + (Math.random() * w * 0.2);
            const y = (h * 0.4) + (Math.random() * h * 0.2);
            const idx = this.terrainGen.getIndex(x, y);
            if (!this.terrainGen.isWater(idx)) {
                this.ss.assembler.spawnEntity({ type: 'human', x, y });
            }
        }

        if (this.engine.chunkManager) {
            this.engine.chunkManager.markAllDirty();
        }

        GlobalLogger.success(`World initialized: ${natureTarget} nature nodes created.`);
    }
}
