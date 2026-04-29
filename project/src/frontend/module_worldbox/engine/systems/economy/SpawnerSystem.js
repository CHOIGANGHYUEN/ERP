import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';
import speciesConfig from '../../config/species.json';
import resourceConfig from '../../config/resource_balance.json';

export default class SpawnerSystem extends System {
    constructor(entityManager, eventBus, terrainGen) {
        super(entityManager, eventBus);
        this.terrainGen = terrainGen; 

        this.eventBus.on('SPAWN_POOP', (payload) => this.spawnPoop(payload.x, payload.y, payload.fertilityAmount));
        this.eventBus.on('SPAWN_ENTITY', (payload) => this.spawnEntity(payload));

        this.eventBus.on('APPLY_TOOL_EFFECT', (payload) => {
            const idx = Math.floor(payload.y) * this.terrainGen.mapWidth + Math.floor(payload.x);
            if (idx >= 0 && idx < this.terrainGen.biomeBuffer.length) {
                if (payload.action.startsWith('SPAWN_')) {
                    const resourceId = payload.resourceId || payload.action.replace('SPAWN_', '').toLowerCase();
                    this.spawnGenericResource(payload.x, payload.y, resourceId, payload.color, payload.treeType);
                } 
                else if (payload.action === 'CHANGE_BIOME') {
                    const ix = Math.floor(payload.x);
                    const iy = Math.floor(payload.y);
                    if (idx >= 0 && idx < this.terrainGen.biomeBuffer.length) {
                        this.terrainGen.biomeBuffer[idx] = payload.biome;
                        this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: ix, y: iy, reason: 'biome_change' });
                    }
                }
            }
        });
    }

    update(dt, time) {
        this.spawnResources();
    }

    spawnResources() {
        for (let i = 0; i < 10; i++) {
            const x = Math.floor(Math.random() * this.terrainGen.mapWidth);
            const y = Math.floor(Math.random() * this.terrainGen.mapHeight);
            const idx = y * this.terrainGen.mapWidth + x;
            const biomeId = this.terrainGen.biomeBuffer[idx];
            const fertility = this.terrainGen.fertilityBuffer[idx];

            if (fertility > 0.3 && (biomeId === BIOME_NAMES_TO_IDS.get('GRASS') || biomeId === BIOME_NAMES_TO_IDS.get('JUNGLE'))) {
                if (Math.random() < fertility * 0.05) {
                    const rand = Math.random();
                    if (fertility > 0.8 && rand < 0.05) {
                        this.spawnGenericResource(x, y, 'oak_tree');
                    } else if (fertility > 0.5 && rand < 0.1) {
                        this.spawnGenericResource(x, y, 'wild_mushroom');
                    } else {
                        this.spawnGenericResource(x, y, 'grass');
                    }
                }
            }
        }
    }

    spawnGenericResource(x, y, resourceId, color, treeTypeOverride = null) {
        if (resourceId === 'plant') resourceId = 'grass';
        const em = this.entityManager;
        const config = resourceConfig[resourceId];
        if (!config) return;

        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const idx = iy * this.terrainGen.mapWidth + ix;

        const isMineral = config.type === 'mineral' || config.type === 'geological' || config.type === 'material';
        const envBuffer = isMineral ? this.terrainGen.mineralDensityBuffer : this.terrainGen.fertilityBuffer;
        const currentVal = envBuffer[idx] || 0;

        // 수중 생물/바다 지형 예외
        const isAquatic = ['deep_sea_kelp', 'seaweed', 'lotus', 'waterweed', 'reed'].includes(resourceId);
        const biomeId = this.terrainGen.biomeBuffer[idx];
        const isWaterBiome = [0, 1, 2, 3].includes(biomeId);
        if (currentVal < 0.05 && !(isAquatic && isWaterBiome)) return;

        const isTree = resourceId.includes('tree');
        const consumed = currentVal;

        // [5단계 상세] 식생 스폰 시 비옥도 차감 및 0.1 하한선 보호 로직
        // 나무는 비옥도를 더 많이 소모하지만, 최소 0.1은 남겨둠
        envBuffer[idx] = Math.max(0.1, isTree ? currentVal * 0.1 : currentVal * 0.5);



        const id = em.createEntity();
        const entity = em.entities.get(id);

        if (entity) {
            entity.components.set('Transform', { x, y });
            const isWithered = consumed < 0.4;

            entity.components.set('Visual', {
                type: resourceId.includes('tree') ? 'tree' : resourceId,
                resourceId: resourceId,
                name: config.name,
                color: color || '#888888',
                quality: consumed,
                isWithered: isWithered,
                size: resourceId.includes('tree') ? 8 : 1
            });

            entity.components.set('Resource', {
                ...config,
                resourceId: resourceId,
                value: Math.floor(consumed * config.capacity),
                storedFertility: consumed, // 뺏어온 양분 저장
                isWithered: isWithered
            });

            // 픽셀 갱신 (구멍이 뚫린 것을 시각적으로 즉시 반영)
            this.eventBus.emit('CACHE_PIXEL_UPDATE', { x: ix, y: iy, reason: 'fertility_change' });
        }
    }

    spawnSheep(x, y, isBaby = false) {
        const em = this.entityManager;
        const config = speciesConfig['sheep'] || {};
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: (config.weight || 50) * (isBaby ? 0.4 : 1) });
            entity.components.set('Visual', { type: 'sheep', size: isBaby ? 0.6 : 1.0 });
            entity.components.set('Animal', { type: 'sheep', isBaby: isBaby, diet: config.diet || 'herbivore', herdId: -1 });
            entity.components.set('Metabolism', { stomach: 0, maxStomach: config.maxStomach || 3.0, digestionSpeed: config.digestionSpeed || 0.15, storedFertility: 0, isPooping: false });
            entity.components.set('AIState', { mode: 'wander', targetId: null });
        }
    }

    spawnEntity(payload) {
        const isBaby = payload.isBaby || false;
        if (payload.type === 'sheep') this.spawnSheep(payload.x, payload.y, isBaby);
        else if (payload.type === 'cow') this.spawnCow(payload.x, payload.y, isBaby);
        else if (payload.type === 'human') this.spawnHuman(payload.x, payload.y, isBaby);
    }
    
    spawnHuman(x, y, isBaby = false) {
        const em = this.entityManager;
        const config = speciesConfig['human'] || {};
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: (config.weight || 70) * (isBaby ? 0.4 : 1) });
            entity.components.set('Visual', { type: 'human', size: isBaby ? 0.6 : 1.0 });
            entity.components.set('Animal', { type: 'human', diet: 'omnivore', isBaby: isBaby });
            entity.components.set('Metabolism', { stomach: 1.0, maxStomach: config.maxStomach || 2.5, digestionSpeed: 0.2, storedFertility: 0 });
            entity.components.set('AIState', { mode: 'wander' });
        }
    }

    spawnCow(x, y, isBaby = false) {
        const em = this.entityManager;
        const config = speciesConfig['cow'] || {};
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y, vx: 0, vy: 0, mass: (config.weight || 500) * (isBaby ? 0.3 : 1) });
            entity.components.set('Visual', { type: 'cow', size: isBaby ? 0.6 : 1.0 });
            entity.components.set('Animal', { type: 'cow', diet: 'herbivore', isBaby: isBaby });
            entity.components.set('Metabolism', { stomach: 1.0, maxStomach: 5.0, digestionSpeed: 0.1, storedFertility: 0 });
            entity.components.set('AIState', { mode: 'wander' });
        }
    }

    spawnPoop(x, y, fertilityAmount = 1.0) {
        const em = this.entityManager;
        const id = em.createEntity();
        const entity = em.entities.get(id);
        if (entity) {
            entity.components.set('Transform', { x, y });
            entity.components.set('Visual', { type: 'poop' });
            entity.components.set('Resource', { isFertilizer: true, amount: 100, fertilityValue: fertilityAmount });
        }
    }
}