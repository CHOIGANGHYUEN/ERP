import { BIOMES } from '../../world/TerrainGen.js';

export default class SpawnerSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt, time) {
        // Passive spawning disabled: Grass now only grows when manually sprinkled!
        // this.spawnResources();
    }

    spawnResources() {
        // Spawn ~5 resources per frame in fertile areas
        for (let i = 0; i < 5; i++) {
            const x = Math.floor(Math.random() * this.engine.mapWidth);
            const y = Math.floor(Math.random() * this.engine.mapHeight);
            const idx = y * this.engine.mapWidth + x;
            const biome = this.engine.terrainGen.biomeBuffer[idx];
            const fertility = this.engine.terrainGen.fertilityBuffer[idx];

            if (fertility > 0 && (biome === BIOMES.GRASS || biome === BIOMES.JUNGLE)) {
                if (Math.random() < fertility * 0.05) { 
                    this.spawnGrass(x, y, fertility);
                }
            }
        }
    }

    spawnGrass(x, y, fertility) {
        const em = this.engine.entityManager;
        if (em.entities.size > 20000) return;

        // BLUEPRINT: Consumes ALL current fertility to spawn (reset to 0.1)
        const idx = Math.floor(y) * this.engine.mapWidth + Math.floor(x);
        const oldVal = this.engine.terrainGen.fertilityBuffer[idx];
        this.engine.terrainGen.fertilityBuffer[idx] = 0.1; // Exhaust the soil
        
        // Track the consumption
        this.engine.updateFertilityStat(oldVal, 0.1);
        
        if (this.engine.viewFlags.fertility) {
            this.engine.updateCachePixel(Math.floor(x), Math.floor(y));
        }

        const id = em.createEntity();
        const entity = em.entities.get(id);
        
        if (entity) {
            // Quality is the EXACT fertility consumed!
            const quality = Math.max(0.1, fertility); 
            
            let r, g, b;
            if (quality > 0.8) { r = 46; g = 150; b = 30; }     // Vibrant Green
            else if (quality > 0.4) { r = 139; g = 195; b = 74; } // Normal
            else { r = 180; g = 180; b = 60; }                   // Withered / Yellow

            entity.components.set('Transform', { x, y });
            entity.components.set('Visual', { 
                color: `rgb(${r},${g},${b})`,
                quality: quality 
            });
            entity.components.set('Resource', { type: 'food', value: Math.floor(quality * 10), edible: true, isGrass: true });
        }
    }

    spawnSheep(x, y, isBaby = false) {
        const em = this.engine.entityManager;
        const config = this.engine.speciesConfig['sheep'] || {};
        
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y, vx: 0, vy: 0 });
            entity.components.set('Visual', { 
                type: 'sheep',
                size: isBaby ? 0.6 : 1.0 
            });
            entity.components.set('Animal', { 
                type: 'sheep', 
                isBaby: isBaby, 
                diet: config.diet || 'herbivore', 
                herdId: -1 
            });
            entity.components.set('Metabolism', { 
                stomach: 0, 
                maxStomach: config.maxStomach || 3.0, 
                digestionSpeed: config.digestionSpeed || 0.15,
                storedFertility: 0, 
                isPooping: false 
            });
            entity.components.set('AIState', { mode: 'wander', targetId: null });
        }
    }

    spawnPoop(x, y) {
        const em = this.engine.entityManager;
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y });
            entity.components.set('Visual', { type: 'poop' });
            entity.components.set('Resource', { isFertilizer: true, amount: 100 }); // Life/Fertility juice
        }
    }
}