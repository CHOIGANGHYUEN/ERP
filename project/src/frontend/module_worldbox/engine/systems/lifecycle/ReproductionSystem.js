import { BIOMES } from '../../world/TerrainGen.js';

export default class ReproductionSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(dt) {
        const em = this.engine.entityManager;
        for (const [id, entity] of em.entities) {
            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            const transform = entity.components.get('Transform');

            if (animal && metabolism && transform) {
                this.processReproduction(id, animal, metabolism, transform);
            }
        }
    }

    processReproduction(id, animal, metabolism, transform) {
        const config = this.engine.speciesConfig[animal.type] || {};
        const reproduceThreshold = config.reproductionThreshold || 1.5;

        // Environment Check (No breeding in water)
        const ix = Math.floor(transform.x);
        const iy = Math.floor(transform.y);
        const idx = iy * this.engine.mapWidth + ix;
        if (this.engine.terrainGen.biomeBuffer[idx] === BIOMES.OCEAN) return;

        // Condition: High fertility, adult, random chance
        if (metabolism.storedFertility > reproduceThreshold && !animal.isBaby && Math.random() < 0.01) {
            const partnerId = this.findPartner(id, animal.type, transform.x, transform.y);
            if (partnerId !== null) {
                this.breed(animal.type, transform.x, transform.y);
                
                // Cost of breeding
                metabolism.storedFertility -= 0.8;
                const partner = this.engine.entityManager.entities.get(partnerId);
                const partnerMet = partner.components.get('Metabolism');
                if (partnerMet) partnerMet.storedFertility -= 0.8;
            }
        }
    }

    findPartner(myId, type, x, y) {
        const em = this.engine.entityManager;
        for (const [id, entity] of em.entities) {
            if (id === myId) continue;
            const animal = entity.components.get('Animal');
            const metabolism = entity.components.get('Metabolism');
            if (animal && animal.type === type && !animal.isBaby && (metabolism?.storedFertility > 1.0)) {
                const pos = entity.components.get('Transform');
                const dx = pos.x - x;
                const dy = pos.y - y;
                if (dx * dx + dy * dy < 1600) return id; // 40px radius
            }
        }
        return null;
    }

    breed(type, x, y) {
        if (type === 'sheep') this.engine.spawner.spawnSheep(x, y, true);
        else if (type === 'human') this.engine.spawner.spawnHuman(x, y, true);

        // Heart particles
        for(let i=0; i<3; i++) {
            this.engine.particles.push({
                x, y: y - 5,
                color: '#ff4081',
                vx: (Math.random()-0.5)*2, vy: -2 - Math.random()*2,
                life: 40
            });
        }
    }
}
