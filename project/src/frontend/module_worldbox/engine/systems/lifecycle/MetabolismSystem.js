import { BIOMES } from '../../world/TerrainGen.js';

export default class MetabolismSystem {
    constructor(engine) {
        this.engine = engine;
        this.excreteThreshold = 1.0;
    }

    update(dt, time) {
        const em = this.engine.entityManager;
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            const transform = entity.components.get('Transform');

            if (animal && metabolism && transform) {
                this.processInternalMetabolism(id, entity, animal, metabolism, transform, dt);
            }
        }
    }

    processInternalMetabolism(id, entity, animal, metabolism, transform, dt) {
        // 1. DIGESTION
        if (metabolism.stomach > 0) {
            const processRate = metabolism.digestionSpeed || 0.05;
            const amount = Math.min(metabolism.stomach, processRate * dt);
            metabolism.stomach -= amount;
            metabolism.storedFertility += amount;
        }

        // 2. EXCRETION
        const ix = Math.floor(transform.x);
        const iy = Math.floor(transform.y);
        const idx = iy * this.engine.mapWidth + ix;
        const currentBiome = this.engine.terrainGen.biomeBuffer[idx];
        const isInWater = currentBiome === BIOMES.OCEAN;

        if (!isInWater && metabolism.storedFertility >= this.excreteThreshold) {
            metabolism.isPooping = true;
            this.excrete(transform.x, transform.y);
            metabolism.storedFertility = 0;
        } else if (metabolism.isPooping) {
            if (Math.random() < 0.05) metabolism.isPooping = false;
        }

        // 3. WANDER (Movement logic)
        const state = entity.components.get('AIState');
        if (state && state.mode === 'wander') {
            this.wander(transform, dt);
        }
    }

    wander(transform, dt) {
        if (!transform.vx || Math.random() < 0.02) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 10 + Math.random() * 15;
            transform.vx = Math.cos(angle) * speed;
            transform.vy = Math.sin(angle) * speed;
        }

        const maxSpeed = 30;
        const mag = Math.sqrt(transform.vx**2 + transform.vy**2);
        if (mag > maxSpeed) {
            transform.vx = (transform.vx / mag) * maxSpeed;
            transform.vy = (transform.vy / mag) * maxSpeed;
        }

        transform.x += transform.vx * dt;
        transform.y += transform.vy * dt;

        if (transform.x < 10) transform.x = 10;
        if (transform.x > 990) transform.x = 990;
        if (transform.y < 10) transform.y = 10;
        if (transform.y > 990) transform.y = 990;
    }

    excrete(x, y) {
        this.engine.spawner.spawnPoop(x, y);
    }
}