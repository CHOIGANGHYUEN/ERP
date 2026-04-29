import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';

export default class EnvironmentSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; // TerrainGen 인스턴스 주입

        // 도구 효과 적용 (파티클 도달 시)
        this.eventBus.on('APPLY_TOOL_EFFECT', (payload) => {
            const idx = Math.floor(payload.y) * this.terrainGen.mapWidth + Math.floor(payload.x);
            if (idx >= 0 && idx < this.terrainGen.biomeBuffer.length) {
                if (payload.action === 'CHANGE_BIOME') {
                    const currentBiomeId = this.terrainGen.biomeBuffer[idx];
                    const isTargetLand = [BIOME_NAMES_TO_IDS.get('DIRT'), BIOME_NAMES_TO_IDS.get('GRASS'), BIOME_NAMES_TO_IDS.get('JUNGLE'), BIOME_NAMES_TO_IDS.get('SAND')].includes(currentBiomeId);

                    // 바다/산에는 칠해지지 않도록 방어 (단, 바다 툴은 허용)
                    if (isTargetLand || payload.biome === BIOME_NAMES_TO_IDS.get('OCEAN')) {
                        // 🌿 식생 바이옴(GRASS, JUNGLE)은 비옥도가 있는 토양(0.05 초과)에서만 자랄 수(칠해질 수) 있음
                        const isPlantBiome = payload.biome === BIOME_NAMES_TO_IDS.get('GRASS') || payload.biome === BIOME_NAMES_TO_IDS.get('JUNGLE');
                        if (!isPlantBiome || this.terrainGen.fertilityBuffer[idx] > 0.05) {
                            this.changePixelBiome(idx, payload.biome);
                        }
                    }
                }
            }
        });
    }

    update(dt, time) {
        const mw = this.terrainGen.mapWidth;
        const mh = this.terrainGen.mapHeight;
        const tg = this.terrainGen;
        const fb = this.terrainGen.fertilityBuffer;

        // 1. Biome Spread (Uniform & Unconditional) - Runs every frame
        for (let i = 0; i < 2000; i++) {
            const idx = Math.floor(Math.random() * (mw * mh));
            const biomeId = this.terrainGen.biomeBuffer[idx];
            const currentFertility = this.terrainGen.fertilityBuffer[idx];
            const isPlantBiome = biomeId === BIOME_NAMES_TO_IDS.get('GRASS') || biomeId === BIOME_NAMES_TO_IDS.get('JUNGLE');

            // 🥀 식생 바이옴인데 비옥도가 바닥났다면 다시 흙(DIRT)으로 되돌아감 (퇴화/사막화 현상)
            if (isPlantBiome && currentFertility <= 0.05) {
                this.changePixelBiome(idx, BIOME_NAMES_TO_IDS.get('DIRT'));
                continue;
            }

            const props = BIOME_PROPERTIES_MAP.get(biomeId);
            // 🚨 biomes.json에 canSpread가 없어도 GRASS와 JUNGLE은 무조건 퍼지도록 예외 처리
            const canSpread = props && (props.canSpread || isPlantBiome);
            if (canSpread) {
                const nx = (idx % mw) + (Math.floor(Math.random() * 3) - 1);
                const ny = Math.floor(idx / mw) + (Math.floor(Math.random() * 3) - 1);
                if (nx >= 0 && nx < mw && ny >= 0 && ny < mh) {
                    const nidx = ny * mw + nx;
                    const targetBiome = this.terrainGen.biomeBuffer[nidx];
                    // 🚨 확산은 오직 비옥도가 0.05 이상인 흙(DIRT) 위에서만 이루어지도록 제한
                    if (targetBiome === BIOME_NAMES_TO_IDS.get('DIRT') && targetBiome !== biomeId && this.terrainGen.fertilityBuffer[nidx] > 0.05) {
                        this.changePixelBiome(nidx, biomeId);
                    }
                }
            }
        }

        // 🌊 자연스러운 비옥도 확산 (Natural Fertility Diffusion)
        // 1초에 한 번 대량으로 처리하지 않고 매 프레임 부드럽게(Smooth) 처리하여 유기적인 흐름을 만듭니다.
        // 비옥도 총량이 보존되므로 무거운 STATS_UPDATED 이벤트를 생략하여 성능을 극대화합니다.
        for (let i = 0; i < 15000; i++) {
            const idx = Math.floor(Math.random() * (mw * mh));
            const val = this.terrainGen.fertilityBuffer[idx];

            if (val <= 0.05) continue; // 비옥도가 거의 없으면 퍼지지 않음

            const nx = (idx % mw) + (Math.floor(Math.random() * 3) - 1);
            const ny = Math.floor(idx / mw) + (Math.floor(Math.random() * 3) - 1);

            if (nx >= 0 && nx < mw && ny >= 0 && ny < mh) {
                const nidx = ny * mw + nx;
                const targetMax = this.getMaxFertility(this.terrainGen.biomeBuffer[nidx]);

                if (targetMax <= 0) continue; // 바다나 바위로는 퍼지지 않음

                const targetVal = this.terrainGen.fertilityBuffer[nidx];

                // ✨ 농도 기울기(Concentration Gradient): 비옥도가 높은 곳에서 낮은 곳으로만 흐름
                if (val > targetVal) {
                    // 🌿 불규칙한 확산 (Irregular Diffusion): 
                    // 20% 확률로 특정 방향의 흐름을 막아 얼룩덜룩한 지형을 만들고,
                    // 확산 비율도 고정이 아닌 무작위(2% ~ 25%)로 적용하여 뻗어나가는 촉수 같은 유기적인 형태를 유도합니다.
                    if (Math.random() < 0.20) continue;

                    const spreadRate = 0.02 + Math.random() * 0.23;
                    const diff = (val - targetVal) * spreadRate;
                    if (diff > 0.002) {
                        const transfer = Math.min(diff, targetMax - targetVal); // 타겟의 최대 수용량을 넘지 않도록
                        if (transfer > 0) {
                            this.terrainGen.fertilityBuffer[idx] -= transfer;
                            this.terrainGen.fertilityBuffer[nidx] += transfer;

                            // 시각적 업데이트만 요청
                            this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: idx % mw, y: Math.floor(idx / mw), reason: 'fertility_change' });
                            this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: nx, y: ny, reason: 'fertility_change' });
                        }
                    }
                }
            }
        }

        this.processDecomposition();
    }

    processDecomposition() {
        const em = this.entityManager;
        const fb = this.terrainGen.fertilityBuffer;
        for (const [id, entity] of em.entities) {
            const res = entity.components.get('Resource');
            if (res && res.isFertilizer) {
                const t = entity.components.get('Transform');
                if (t) {
                    const idx = Math.floor(t.y) * this.terrainGen.mapWidth + Math.floor(t.x);
                    if (idx >= 0 && idx < fb.length) {
                        const oldVal = fb[idx];

                        // 거름의 잔존 시간(amount=100, 틱당 0.5 감소 = 200틱) 동안 비옥도를 나누어 땅에 온전히 흡수시킴
                        const lifetimeTicks = 100 / 0.5;
                        const restoreAmount = (res.fertilityValue || 1.0) / lifetimeTicks;
                        this.terrainGen.fertilityBuffer[idx] = Math.min(1.0, this.terrainGen.fertilityBuffer[idx] + restoreAmount);
                        this.eventBus.emit('STATS_UPDATED', { type: 'fertility', oldVal: oldVal, newVal: this.terrainGen.fertilityBuffer[idx] });

                        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: Math.floor(t.x), y: Math.floor(t.y), reason: 'fertility_change' });

                        res.amount -= 0.5;
                        if (res.amount <= 0) em.removeEntity(id);
                    }
                }
            }
        }
    }

    getMaxFertility(biome) {
        const props = BIOME_PROPERTIES_MAP.get(biome);
        // maxFertility 속성이 없으면 baseSoilFertility로 대체하여 0.0이 반환되는 것을 방지
        return props ? (props.maxFertility || props.baseSoilFertility || 0.0) : 0.0;
    }

    changePixelBiome(idx, biomeId) {
        const tg = this.terrainGen;
        const oldFert = tg.fertilityBuffer[idx];
        const oldMax = this.getMaxFertility(tg.biomeBuffer[idx]);
        const newMaxCapacity = this.getMaxFertility(biomeId);

        tg.biomeBuffer[idx] = biomeId;

        // 🌍 비옥도는 토지의 고유 양분이므로 바이옴이 덮어씌워져도 초기화되지 않고 유지됩니다.
        // 단, 산맥 등 비옥도를 가질 수 없는 지형으로 변할 때만 해당 지형의 한계치로 보정합니다.
        const newFertility = Math.min(oldFert, newMaxCapacity);
        tg.fertilityBuffer[idx] = newFertility;

        if (oldFert !== newFertility) {
            this.eventBus.emit('STATS_UPDATED', { type: 'fertility', oldVal: oldFert, newVal: newFertility });
        }
        this.eventBus.emit('STATS_UPDATED', { type: 'potential_fertility', oldVal: oldMax, newVal: newMaxCapacity });

        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: idx % this.terrainGen.mapWidth, y: Math.floor(idx / this.terrainGen.mapWidth), reason: 'biome_change' });
        if (biomeId === BIOME_NAMES_TO_IDS.get('OCEAN')) this.eventBus.emit('REFRESH_WATER_PIXELS');
    }
}