import resourceConfig from '../../../config/resource_balance.json';
import { GlobalLogger } from '../../../utils/Logger.js';

/**
 * 🥚 EcosystemAssembler
 * 구체적인 엔티티 타입 파악 및 하위 팩토리 매핑(Assembler) 역할을 담당합니다.
 * SpawnerSystem.js에서 SRP에 따라 분리되었습니다.
 */
export default class EcosystemAssembler {
    constructor(spawnerSystem) {
        this.ss = spawnerSystem;
        this.engine = spawnerSystem.engine;
        this.entityManager = spawnerSystem.entityManager;
    }

    spawnGenericResource(x, y, resourceId, forceSpawn = false, isInitializing = false) {
        if (resourceId === 'plant') resourceId = 'grass';
        const config = resourceConfig[resourceId];
        if (!config) return null;

        const tg = this.ss.terrainGen;
        const idx = tg.getIndex(x, y);
        const isMineral = ['mineral', 'geological', 'material'].includes(config.type);
        const envValue = isMineral ? tg.mineralDensityBuffer[idx] : tg.fertilityBuffer[idx] / 100;

        if (!forceSpawn) {
            const isAquatic = ['deep_sea_kelp', 'seaweed', 'lotus', 'waterweed', 'reed'].includes(resourceId);
            const isWater = tg.isWater(idx);
            if (isWater !== isAquatic) return null;
            if (envValue < 0.1) return null;
        }

        const category = isMineral ? 'resource' : 'nature';
        const gx = Math.floor(x / 16);
        const gy = Math.floor(y / 16);

        if (config.type === 'tree') {
            if (!forceSpawn && !isInitializing) {
                if (this.ss.treeOccupancyBuffer.length > 0) {
                    for (let oy = -1; oy <= 1; oy++) {
                        const cy = gy + oy;
                        if (cy < 0 || cy >= this.ss.treeOccupancyGridH) continue;
                        const rowOffset = cy * this.ss.treeOccupancyGridW;
                        for (let ox = -1; ox <= 1; ox++) {
                            const cx = gx + ox;
                            if (cx < 0 || cx >= this.ss.treeOccupancyGridW) continue;
                            if (this.ss.treeOccupancyBuffer[rowOffset + cx] === 1) return null;
                        }
                    }
                }
            }
        }

        if (isNaN(x) || isNaN(y)) return null;

        const entityId = this.engine.factoryProvider.spawn(category, resourceId, x, y, {
            quality: forceSpawn ? 0.8 : envValue,
            skipDirty: isInitializing
        });

        if (entityId) {
            if (config.type === 'tree' && this.ss.treeOccupancyBuffer.length > 0 && 
                gx >= 0 && gx < this.ss.treeOccupancyGridW && gy >= 0 && gy < this.ss.treeOccupancyGridH) {
                this.ss.treeOccupancyBuffer[gy * this.ss.treeOccupancyGridW + gx] = 1;
            }
            this._handleSpecialResourceSpawn(resourceId, x, y, entityId);
        }

        return entityId;
    }

    spawnEntity(payload) {
        const type = payload.type || this._deriveTypeFromMethod(payload.method);
        if (!type) return null;

        const category = this._determineCategory(type);

        const newId = this.engine.factoryProvider.spawn(category, type, payload.x, payload.y, {
            isBaby: payload.isBaby || false,
            quality: payload.quality || 1.0
        });

        if (newId && payload.killerId) {
            const killer = this.entityManager.entities.get(payload.killerId);
            const state = killer?.components.get('AIState');
            if (state) {
                state.targetId = newId;
                state.failedPathCount = 0;
            }
        }

        if (newId) {
            this.ss.eventBus.emit('ENTITY_SPAWNED', { id: newId, type, category, x: payload.x, y: payload.y });
        }

        return newId;
    }

    spawnBee(x, y, role = 'worker', hiveId = null) {
        const id = this.engine.factoryProvider.spawn('animal', 'bee', x, y);
        const ent = this.entityManager.entities.get(id);
        if (!ent) return null;

        const animal = ent.components.get('Animal');
        if (animal) {
            animal.role = role;
            animal.hiveId = hiveId;
            if (hiveId) {
                const hive = this.entityManager.entities.get(hiveId);
                const hiveComp = hive?.components.get('Hive');
                if (hiveComp) hiveComp.beeCount++;
            }
        }

        const visual = ent.components.get('Visual');
        if (visual) visual.role = role;

        return id;
    }

    _handleSpecialResourceSpawn(resourceId, x, y, entityId) {
        if (resourceId.includes('beehive')) {
            this.spawnBee(x, y, 'queen', entityId);
            for (let i = 0; i < 3; i++) this.spawnBee(x, y, 'worker', entityId);
        }
    }

    _deriveTypeFromMethod(method) {
        if (!method) return null;
        let type = method.replace('spawn', '').toLowerCase();
        if (type === 'wilddog') return 'wild_dog';
        return type;
    }

    _determineCategory(type) {
        const itemTypes = ['meat', 'poop', 'wood', 'stone', 'food', 'gold', 'leather', 'bone', 'iron', 'silver', 'copper'];
        if (itemTypes.includes(type)) return 'item';
        if (type === 'human') return 'human';
        return 'animal';
    }
}
