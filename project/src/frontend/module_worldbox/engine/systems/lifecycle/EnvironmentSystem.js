import { BIOMES, BiomeProperties } from '../../world/TerrainGen.js';

export default class EnvironmentSystem {
    constructor(engine) {
        this.engine = engine;
        this.lastDiffusionTime = 0;
    }

    update(dt, time) {
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;
        const tg = this.engine.terrainGen;
        const fb = tg.fertilityBuffer;

        // 1. Biome Spread (Uniform & Unconditional) - Runs every frame
        for (let i = 0; i < 2000; i++) {
            const idx = Math.floor(Math.random() * (mw * mh));
            const biome = tg.biomeBuffer[idx];

            const props = BiomeProperties[biome];
            if (props && props.canSpread) {
                const nx = (idx % mw) + (Math.floor(Math.random() * 3) - 1);
                const ny = Math.floor(idx / mw) + (Math.floor(Math.random() * 3) - 1);
                if (nx >= 0 && nx < mw && ny >= 0 && ny < mh) {
                    const nidx = ny * mw + nx;
                    if (tg.biomeBuffer[nidx] !== biome) {
                        this.changePixelBiome(nidx, biome);
                    }
                }
            }
        }

        // 🌊 1-SECOND PULSE DIFFUSION (High to Low Flow)
        // Optimized to run once every second as requested
        if (time - this.lastDiffusionTime > 1000) {
            this.lastDiffusionTime = time;

            for (let i = 0; i < 100000; i++) {
                const idx = Math.floor(Math.random() * (mw * mh));
                const val = fb[idx];
                if (val < 0.15) continue;

                const nx = (idx % mw) + (Math.floor(Math.random() * 3) - 1);
                const ny = Math.floor(idx / mw) + (Math.floor(Math.random() * 3) - 1);

                if (nx >= 0 && nx < mw && ny >= 0 && ny < mh) {
                    const nidx = ny * mw + nx;
                    const targetMax = this.getMaxFertility(tg.biomeBuffer[nidx]);

                    // Connected Biome pixels only!
                    if (targetMax <= 0) continue;

                    const diff = (val - fb[nidx]) * 0.25;
                    if (diff > 0.001) {
                        const oldSource = fb[idx];
                        const oldTarget = fb[nidx];

                        fb[idx] = Math.max(0.1, fb[idx] - diff);
                        fb[nidx] = Math.min(targetMax, fb[nidx] + diff);

                        this.engine.updateFertilityStat(oldSource, fb[idx]);
                        this.engine.updateFertilityStat(oldTarget, fb[nidx]);

                        // Mark for precision redraw (Dirty Set)
                        if (this.engine.viewFlags.fertility) {
                            this.engine.updateCachePixel(idx % mw, Math.floor(idx / mw));
                            this.engine.updateCachePixel(nx, ny);
                        }
                    }
                }
            }
        }

        this.processDecomposition();
    }

    processDecomposition() {
        const em = this.engine.entityManager;
        const fb = this.engine.terrainGen.fertilityBuffer;
        for (const [id, entity] of em.entities) {
            const res = entity.components.get('Resource');
            if (res && res.isFertilizer) {
                const t = entity.components.get('Transform');
                if (t) {
                    const idx = Math.floor(t.y) * this.engine.mapWidth + Math.floor(t.x);
                    if (idx >= 0 && idx < fb.length) {
                        const oldVal = fb[idx];

                        // 거름의 잔존 시간(amount=100, 틱당 0.5 감소 = 200틱) 동안 비옥도를 나누어 땅에 온전히 흡수시킴
                        const lifetimeTicks = 100 / 0.5;
                        const restoreAmount = (res.fertilityValue || 1.0) / lifetimeTicks;
                        fb[idx] = Math.min(1.0, fb[idx] + restoreAmount);
                        this.engine.updateFertilityStat(oldVal, fb[idx]);

                        if (this.engine.viewFlags.fertility) this.engine.updateCachePixel(Math.floor(t.x), Math.floor(t.y));

                        res.amount -= 0.5;
                        if (res.amount <= 0) em.removeEntity(id);
                    }
                }
            }
        }
    }

    getMaxFertility(biome) {
        const props = BiomeProperties[biome];
        return props ? props.maxFertility : 0.0;
    }

    changePixelBiome(idx, biome) {
        const tg = this.engine.terrainGen;
        const oldFert = tg.fertilityBuffer[idx];
        const oldMax = this.getMaxFertility(tg.biomeBuffer[idx]);
        const newMaxCapacity = this.getMaxFertility(biome);

        const initialFertility = newMaxCapacity > 0 ? newMaxCapacity * (0.4 + Math.random() * 0.6) : 0;

        tg.biomeBuffer[idx] = biome;
        tg.fertilityBuffer[idx] = initialFertility;

        this.engine.updateFertilityStat(oldFert, initialFertility);
        this.engine.updatePotentialStat(oldMax, newMaxCapacity);

        this.engine.updateCachePixel(idx % this.engine.mapWidth, Math.floor(idx / this.engine.mapWidth));
        if (biome === BIOMES.OCEAN) this.engine.refreshWaterPixels();
    }
}