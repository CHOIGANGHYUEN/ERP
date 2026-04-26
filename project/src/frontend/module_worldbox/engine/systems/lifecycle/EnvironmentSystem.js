import { BIOMES } from '../../world/TerrainGen.js';

export default class EnvironmentSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt, time) {
        const mw = this.engine.mapWidth;
        const mh = this.engine.mapHeight;
        const tg = this.engine.terrainGen;
        
        // 1. Biome Spread (Driven by Max Fertility)
        for (let i = 0; i < 2000; i++) {
            const idx = Math.floor(Math.random() * (mw * mh));
            const biome = tg.biomeBuffer[idx];
            const x = idx % mw;
            const y = Math.floor(idx / mw);

            if ([BIOMES.GRASS, BIOMES.JUNGLE, BIOMES.SAND].includes(biome)) {
                const nx = x + (Math.floor(Math.random() * 3) - 1);
                const ny = y + (Math.floor(Math.random() * 3) - 1);
                
                if (nx >= 0 && nx < mw && ny >= 0 && ny < mh) {
                    const nidx = ny * mw + nx;
                    const targetBiome = tg.biomeBuffer[nidx];
                    
                    if (targetBiome !== biome) {
                        // BLUEPRINT: Spread is UNCONDITIONAL. 
                        // The only relationship is that the new pixel gets the Max Fertility of the biome.
                        this.changePixelBiome(nidx, biome);
                    }
                }
            } else if (biome === BIOMES.DIRT) {
                // Natural sand/beach wrapping
                const nx = (idx % mw) + (Math.floor(Math.random() * 3) - 1);
                const ny = Math.floor(idx / mw) + (Math.floor(Math.random() * 3) - 1);
                if (nx >= 0 && nx < mw && ny >= 0 && ny < mh) {
                    if (tg.biomeBuffer[ny * mw + nx] === BIOMES.OCEAN) this.changePixelBiome(idx, BIOMES.BEACH);
                }
            }
        }

        // 2. Fertility Diffusion (Crucial for spreading biomes)
        for (let i = 0; i < 1500; i++) {
            const idx = Math.floor(Math.random() * (mw * mh));
            this.diffuseFertility(idx, mw, mh);
        }

        this.processDecomposition();
    }

    processDecomposition() {
        const em = this.engine.entityManager;
        const tg = this.engine.terrainGen;
        for (const [id, entity] of em.entities) {
            const res = entity.components.get('Resource');
            if (res && res.isFertilizer) { // Changed to match SpawnerSystem's isFertilizer
                const t = entity.components.get('Transform');
                if (t) {
                    const idx = Math.floor(t.y) * this.engine.mapWidth + Math.floor(t.x);
                    if (idx >= 0 && idx < tg.fertilityBuffer.length) {
                        // Slowly add to soil
                        tg.fertilityBuffer[idx] = Math.min(1.0, tg.fertilityBuffer[idx] + 0.05);
                        if (this.engine.viewFlags.fertility) this.engine.updateCachePixel(Math.floor(t.x), Math.floor(t.y));
                        
                        // Age the fertilizer entity
                        res.amount -= 0.5;
                        if (res.amount <= 0) em.removeEntity(id);
                    }
                }
            }
        }
    }

    getMaxFertility(biome) {
        if (biome === BIOMES.JUNGLE) return 1.0;
        if (biome === BIOMES.GRASS) return 0.7;
        
        // BLUEPRINT: Non-biological terrains (Dirt, Sand, Beach, Ocean) CANNOT hold fertility.
        return 0.0; 
    }

    changePixelBiome(idx, biome) {
        const tg = this.engine.terrainGen;
        const oldVal = tg.fertilityBuffer[idx];
        const newVal = this.getMaxFertility(biome);

        tg.biomeBuffer[idx] = biome;
        tg.fertilityBuffer[idx] = newVal;
        
        // Track global change
        this.engine.updateFertilityStat(oldVal, newVal);

        const x = idx % this.engine.mapWidth;
        const y = Math.floor(idx / this.engine.mapWidth);
        this.engine.updateCachePixel(x, y);
        if (biome === BIOMES.OCEAN) this.engine.refreshWaterPixels();
    }

    diffuseFertility(idx, mw, mh) {
        const fb = this.engine.terrainGen.fertilityBuffer;
        const val = fb[idx];
        if (val < 0.1) return; // 0.1 is minimum threshold

        const nx = (idx % mw) + (Math.floor(Math.random() * 3) - 1);
        const ny = Math.floor(idx / mw) + (Math.floor(Math.random() * 3) - 1);

        if (nx >= 0 && nx < mw && ny >= 0 && ny < mh) {
            const nidx = ny * mw + nx;
            const diff = (val - fb[nidx]) * 0.15; // 15% diffusion
            if (diff > 0.01) {
                const oldSource = fb[idx];
                const oldTarget = fb[nidx];
                
                fb[idx] = Math.max(0.1, fb[idx] - diff);
                fb[nidx] = Math.min(1.0, fb[nidx] + diff);
                
                // Track changes
                this.engine.updateFertilityStat(oldSource, fb[idx]);
                this.engine.updateFertilityStat(oldTarget, fb[nidx]);
                
                // Visual update if needed
                if (this.engine.viewFlags.fertility && Math.random() < 0.05) {
                    this.engine.updateCachePixel(nx, ny);
                }
            }
        }
    }

    changePixelBiome(idx, newBiome) {
        const tg = this.engine.terrainGen;
        if (!tg.biomeBuffer || !tg.fertilityBuffer) return;

        // Accounting for fertility
        const oldVal = tg.reclaimFertility(idx);
        this.engine.allocatedFertility -= oldVal;
        
        tg.biomeBuffer[idx] = newBiome;
        
        // When a biome is created, it takes some fertility
        const newVal = tg.assignFertility(idx, 0.5); // Fixed hum for now
        this.engine.allocatedFertility += newVal;

        this.engine.updateCachePixel(idx % this.engine.mapWidth, Math.floor(idx / this.engine.mapWidth));
    }
}