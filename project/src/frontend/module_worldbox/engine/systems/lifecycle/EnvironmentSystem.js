import System from '../../core/System.js';
import { BIOME_NAMES_TO_IDS, BIOME_PROPERTIES_MAP } from '../../world/TerrainGen.js';

export default class EnvironmentSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.tg = engine.terrainGen;
        this.spreadCooldown = 0;
    }

    update(dt, time) {
        if (!this.engine.simParams) return;

        // --- Biome Spreading Logic ---
        this.spreadCooldown -= dt;
        if (this.spreadCooldown <= 0) {
            // 🌡️ [사용자 피드백 반영] 속도 수치가 높을수록 쿨다운이 짧아지도록 역수로 계산 (Higher value = Faster)
            const speed = Math.max(0.01, this.engine.simParams.spreadSpeed || 1.0);
            this.spreadCooldown = 1.0 / speed; 
            this.processBiomeSpreading();
        }
    }

    processBiomeSpreading() {
        const amount = this.engine.simParams.spreadAmount || 1000;
        const width = this.tg.mapWidth;
        const height = this.tg.mapHeight;
        const biomeBuffer = this.tg.biomeBuffer;
        const fertilityBuffer = this.tg.fertilityBuffer;

        if (!BIOME_NAMES_TO_IDS) return;
        const DIRT_ID = BIOME_NAMES_TO_IDS.get('DIRT');
        const GRASS_ID = BIOME_NAMES_TO_IDS.get('GRASS');

        if (DIRT_ID === undefined || GRASS_ID === undefined) return;

        for (let i = 0; i < amount; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            const idx = this.tg.getIndex(x, y);

            if (biomeBuffer[idx] !== DIRT_ID) {
                continue; // 흙(DIRT) 타일만 확산의 대상이 됨
            }

            const fertility = fertilityBuffer[idx];
            if (fertility < 0.2) { // 최소 비옥도 20% 이상 필요
                continue;
            }

            // 인접 타일에 확산의 근원(GRASS)이 있는지 확인
            const neighbors = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }];
            let hasGrassNeighbor = false;
            for (const n of neighbors) {
                const nx = x + n.dx;
                const ny = y + n.dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = this.tg.getIndex(nx, ny);
                    if (biomeBuffer[nIdx] === GRASS_ID) {
                        hasGrassNeighbor = true;
                        break;
                    }
                }
            }

            if (hasGrassNeighbor) {
                // 비옥도에 비례하여 확산 확률 증가
                const spreadChance = fertility * 0.05; // 100% 비옥도에서 5% 확률
                if (Math.random() < spreadChance) {
                    biomeBuffer[idx] = GRASS_ID; // 흙이 초원으로 변경
                    this.eventBus.emit('CACHE_PIXEL_UPDATE', { x, y, reason: 'biome_spread' });
                }
            }
        }
    }

    /**
     * 바이옴 ID에 해당하는 최대 비옥도를 반환합니다.
     * @param {number} biomeId - 바이옴 ID
     * @returns {number} 최대 비옥도 (0-100)
     */
    getMaxFertility(biomeId) {
        if (BIOME_PROPERTIES_MAP && BIOME_PROPERTIES_MAP.has(biomeId)) {
            return BIOME_PROPERTIES_MAP.get(biomeId).maxFertility || 0;
        }
        return 0;
    }
}