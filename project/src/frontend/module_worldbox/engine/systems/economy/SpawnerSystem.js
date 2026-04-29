import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';
import speciesConfig from '../../config/species.json';
import resourceConfig from '../../config/resource_balance.json';

export default class SpawnerSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; // TerrainGen 인스턴스 주입

        // EventBus Subscriptions
        this.eventBus.on('SPAWN_POOP', (payload) => this.spawnPoop(payload.x, payload.y, payload.fertilityAmount));
        this.eventBus.on('SPAWN_ENTITY', (payload) => this.spawnEntity(payload));

        this.eventBus.on('APPLY_TOOL_EFFECT', (payload) => {
            const idx = Math.floor(payload.y) * this.terrainGen.mapWidth + Math.floor(payload.x);
            if (idx >= 0 && idx < this.terrainGen.biomeBuffer.length) {
                const fertile = this.terrainGen.fertilityBuffer[idx] || 0;
                if (payload.action === 'SPAWN_PLANT' && fertile > 0.1) this.spawnGrass(payload.x, payload.y, Math.min(1.0, fertile));
                else if (payload.action === 'SPAWN_FLOWER' && fertile > 0.1) this.spawnFlower(payload.x, payload.y, Math.min(1.0, fertile));
                else if (payload.action === 'SPAWN_TREE' && fertile > 0.15) this.spawnTree(payload.x, payload.y, payload.treeType, Math.min(1.0, fertile));
            }
        });
    }

    update(dt, time) {
        // 자연적인 생태계 스폰 활성화
        this.spawnResources();
    }

    spawnResources() {
        // 매 프레임마다 무작위 지점을 탐색하여 비옥도가 높은 곳에 식물 자연 스폰
        for (let i = 0; i < 10; i++) {
            const x = Math.floor(Math.random() * this.terrainGen.mapWidth);
            const y = Math.floor(Math.random() * this.terrainGen.mapHeight);
            const idx = y * this.terrainGen.mapWidth + x;
            const biomeId = this.terrainGen.biomeBuffer[idx];
            const fertility = this.terrainGen.fertilityBuffer[idx];

            // 잔디나 정글 바이옴이고 비옥도가 일정 수준 이상일 때
            if (fertility > 0.2 && (biomeId === BIOME_NAMES_TO_IDS.get('GRASS') || biomeId === BIOME_NAMES_TO_IDS.get('JUNGLE'))) {
                // 비옥도가 높을수록 스폰 확률 증가
                if (Math.random() < fertility * 0.05) { // 스폰 확률 조정
                    const rand = Math.random();
                    // 비옥도가 매우 높으면 나무 스폰 (5% 확률)
                    if (fertility > 0.8 && rand < 0.05) {
                        let type = 'normal';
                        const typeRand = Math.random();
                        if (typeRand < 0.01) type = 'beehive'; // 1% 매우 희박한 확률로 벌집 나무 스폰
                        else if (typeRand < 0.20) type = 'fruit'; // 19% 확률로 과일 나무 스폰
                        this.spawnTree(x, y, type, Math.min(1.0, fertility));
                    }
                    // 비옥도가 꽤 높으면 꽃 스폰 (15% 확률)
                    else if (fertility > 0.6 && rand < 0.20) {
                        this.spawnFlower(x, y, fertility);
                    }
                    // 기본적으로는 풀 스폰
                    else {
                        this.spawnGrass(x, y, fertility);
                    }
                }
            }
        }
    }

    spawnGrass(x, y, fertility) {
        const em = this.entityManager;
        if (em.entities.size > 20000) return;

        const ix = Math.floor(x);
        const iy = Math.floor(y);

        // 🛡️ ANTI-REDUNDANCY: Don't spawn if grass already exists here
        for (const [id, entity] of em.entities) {
            const t = entity.components.get('Transform');
            const r = entity.components.get('Resource');
            if (r && r.isGrass && t && Math.floor(t.x) === ix && Math.floor(t.y) === iy) {
                return; // Already occupied!
            }
        }

        // BLUEPRINT: Consumes ALL current fertility to spawn (reset to 0.1)
        const idx = iy * this.terrainGen.mapWidth + ix;
        const oldVal = this.terrainGen.fertilityBuffer[idx];
        this.terrainGen.fertilityBuffer[idx] = 0.1; // Exhaust the soil

        // Track the consumption
        this.eventBus.emit('STATS_UPDATED', { type: 'fertility', oldVal: oldVal, newVal: 0.1 });

        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: ix, y: iy, reason: 'fertility_change' });

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
            entity.components.set('Resource', { type: 'food', value: Math.floor(quality * 10), edible: true, isGrass: true, storedFertility: quality });
        }
    }

    spawnFlower(x, y, quality) {
        const em = this.entityManager;
        if (em.entities.size > 20000) return;

        const ix = Math.floor(x);
        const iy = Math.floor(y);

        // Anti-Redundancy
        for (const [id, entity] of em.entities) {
            const t = entity.components.get('Transform');
            const r = entity.components.get('Resource');
            if (r && (r.isGrass || r.isFlower) && t && Math.floor(t.x) === ix && Math.floor(t.y) === iy) return;
        }

        // 💎 CONTEXT: Consume fertility and update stats
        const idx = iy * this.terrainGen.mapWidth + ix;
        const oldVal = this.terrainGen.fertilityBuffer[idx] || 0;
        this.terrainGen.fertilityBuffer[idx] = 0.1; // Exhausted
        this.eventBus.emit('STATS_UPDATED', { type: 'fertility', oldVal: oldVal, newVal: 0.1 });

        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: ix, y: iy, reason: 'fertility_change' });

        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            const colors = ['#ff5252', '#ff4081', '#ffeb3b', '#e040fb', '#ffffff'];
            const petalColor = colors[Math.floor(Math.random() * colors.length)];

            entity.components.set('Transform', { x, y });
            entity.components.set('Visual', {
                type: 'flower',
                color: petalColor,
                quality: quality // 🌸 Vital for 'withered' look
            });
            const config = resourceConfig['flower'] || { nutrition: 15, edible: true };
            entity.components.set('Resource', {
                type: 'food',
                value: Math.floor(quality * config.nutrition),
                edible: config.edible,
                isFlower: true,
                storedFertility: quality
            });
        }
    }

    spawnSheep(x, y, isBaby = false) {
        const em = this.entityManager;
        const config = speciesConfig['sheep'] || {};

        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: (config.weight || 50) * (isBaby ? 0.4 : 1) });
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

    spawnHuman(x, y, isBaby = false) {
        const em = this.entityManager;
        const config = speciesConfig['human'] || {};

        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: (config.weight || 70) * (isBaby ? 0.4 : 1) });
            entity.components.set('Visual', { type: 'human', size: isBaby ? 0.6 : 1.0 });
            entity.components.set('Animal', {
                type: 'human', diet: 'omnivore', isBaby: isBaby
            });
            entity.components.set('Metabolism', {
                stomach: 1.0,
                maxStomach: config.maxStomach || 2.5,
                digestionSpeed: 0.2,
                storedFertility: 0
            });
            entity.components.set('AIState', { mode: 'wander' });

            // 🏙️ Humanity specific: Can build and progress
            entity.components.set('Civilization', { techLevel: 0, villageId: -1 });
        }
    }

    spawnCow(x, y, isBaby = false) {
        const em = this.entityManager;
        const config = speciesConfig['cow'] || {};
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            const isDairy = Math.random() < 0.5; // 50% 확률로 젖소
            const cowType = isDairy ? 'dairy' : 'beef';

            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: (config.weight || 500) * (isBaby ? 0.3 : 1) });
            entity.components.set('Visual', { type: 'cow', cowType: cowType, size: isBaby ? 0.6 : 1.0 });
            entity.components.set('Animal', { type: 'cow', diet: config.diet || 'herbivore', herdId: -1, isBaby: isBaby });
            entity.components.set('Metabolism', {
                stomach: 1.0,
                maxStomach: config.maxStomach || 5.0,
                digestionSpeed: config.digestionSpeed || 0.1,
                storedFertility: 0,
                isPooping: false
            });
            entity.components.set('AIState', { mode: 'wander' });

            if (isDairy) {
                entity.components.set('Resource', { type: 'milk', amount: 10, meat: 2 });
            } else {
                entity.components.set('Resource', { type: 'meat', amount: 10 });
            }
        }
    }

    spawnPredator(x, y, type, isBaby = false) {
        const em = this.entityManager;
        const config = speciesConfig[type] || {};
        const id = em.createEntity();
        const entity = em.entities.get(id);

        if (entity) {
            const rank = Math.floor(Math.random() * 100) + 1; // 1~100 사이의 서열(힘)

            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: (config.weight || 40) * (isBaby ? 0.4 : 1) });
            entity.components.set('Visual', { type: type, size: isBaby ? 0.6 : 1.0 });
            entity.components.set('Animal', {
                type: type,
                diet: config.diet || 'carnivore',
                herdId: -1,
                rank: rank,
                isBaby: isBaby
            });
            entity.components.set('Metabolism', {
                stomach: config.maxStomach * 0.5 || 1.5,
                maxStomach: config.maxStomach || 3.0,
                digestionSpeed: config.digestionSpeed || 0.15,
                storedFertility: 0,
                isPooping: false
            });
            entity.components.set('AIState', { mode: 'wander' });
        }
    }
    spawnWolf(x, y, isBaby = false) { this.spawnPredator(x, y, 'wolf', isBaby); }
    spawnHyena(x, y, isBaby = false) { this.spawnPredator(x, y, 'hyena', isBaby); }
    spawnWildDog(x, y, isBaby = false) { this.spawnPredator(x, y, 'wild_dog', isBaby); }

    spawnTree(x, y, treeType = 'normal', fertility = 1.0) {
        const em = this.entityManager;
        if (em.entities.size > 20000) return;

        const ix = Math.floor(x);
        const iy = Math.floor(y);

        // 최소 거리 보장 (나무가 너무 겹치지 않게)
        for (const [id, entity] of em.entities) {
            const t = entity.components.get('Transform');
            const r = entity.components.get('Resource');
            if (r && r.isTree && t) {
                const dx = t.x - x;
                const dy = t.y - y;
                if (dx * dx + dy * dy < 100) return; // 반경 10px 이내 스폰 불가
            }
        }

        // 토양 비옥도를 흡수하여 나무의 두께(크기) 결정
        const idx = iy * this.terrainGen.mapWidth + ix;
        const oldVal = this.terrainGen.fertilityBuffer[idx] || 0;
        const consumed = Math.min(1.0, oldVal);

        this.terrainGen.fertilityBuffer[idx] = 0.05; // 양분을 거의 다 흡수함
        this.eventBus.emit('STATS_UPDATED', { type: 'fertility', oldVal: oldVal, newVal: this.terrainGen.fertilityBuffer[idx] });

        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            let r = 46, g = 125, b = 50;
            let resourceValue = 100;

            if (treeType === 'fruit') { r = 104; g = 159; b = 56; resourceValue = 120; }
            else if (treeType === 'beehive') { r = 175; g = 180; b = 43; resourceValue = 150; }

            // 비옥도(0.0~1.0)에 따라 두께/크기 5~10 할당
            const size = Math.floor(5 + consumed * 5);
            const isWithered = consumed < 0.4;

            // 시들시들한 상태면 색상을 황갈색으로 탁하게 만들고 자원량 감소
            if (isWithered) {
                r = Math.floor((r + 160) / 2);
                g = Math.floor((g + 140) / 2);
                b = Math.floor((b + 80) / 2);
                resourceValue = Math.floor(resourceValue * 0.5);
            }

            entity.components.set('Transform', { x, y });
            entity.components.set('Visual', {
                type: 'tree',
                treeType: treeType,
                isWithered: isWithered,
                color: `rgb(${r},${g},${b})`,
                size: size
            });
            entity.components.set('Resource', {
                type: 'wood', value: resourceValue, isTree: true, treeType: treeType, storedFertility: consumed, honey: 0
            });

            // 벌집 나무 생성 시 여왕벌 1마리와 일벌 3마리 최초 스폰
            if (treeType === 'beehive') {
                this.spawnBee(x, y, 'queen', id);
                for (let i = 0; i < 3; i++) this.spawnBee(x, y + 5, 'worker', id);
            }
        }
    }

    spawnBee(x, y, role = 'worker', hiveId = null) {
        const em = this.entityManager;
        const config = speciesConfig['bee'] || {};

        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: config.weight || 1 });
            entity.components.set('Visual', {
                type: 'bee',
                role: role
            });
            entity.components.set('Animal', {
                type: 'bee',
                role: role,
                hiveId: hiveId,
                diet: 'herbivore'
            });
            entity.components.set('Metabolism', {
                stomach: 1.0, maxStomach: 1.0, digestionSpeed: 0.1, storedFertility: 0
            });
            // 자체 전용 AI State를 부여하여 MetabolismSystem의 기본 WANDER 동작과 충돌 방지
            entity.components.set('AIState', { mode: 'bee_inside' });
        }
    }

    spawnPoop(x, y, fertilityAmount = 1.0) {
        const em = this.entityManager;
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            const config = resourceConfig['poop'] || { amount: 100 };
            entity.components.set('Transform', { x, y });
            entity.components.set('Visual', { type: 'poop' });
            entity.components.set('Resource', { isFertilizer: true, amount: config.amount, fertilityValue: fertilityAmount }); // 소화된 비옥도를 품고 있음
        }
    }

    spawnEntity(payload) {
        const isBaby = payload.isBaby || false;
        if (payload.type === 'sheep') this.spawnSheep(payload.x, payload.y, isBaby);
        else if (payload.type === 'cow') this.spawnCow(payload.x, payload.y, isBaby);
        else if (payload.type === 'human') this.spawnHuman(payload.x, payload.y, isBaby);
        else if (payload.type === 'wolf') this.spawnWolf(payload.x, payload.y, isBaby);
        else if (payload.type === 'hyena') this.spawnHyena(payload.x, payload.y, isBaby);
        else if (payload.type === 'wild_dog') this.spawnWildDog(payload.x, payload.y, isBaby);
    }
}