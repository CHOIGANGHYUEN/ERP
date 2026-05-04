import { BIOME_PROPERTIES_MAP, BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';
import speciesConfig from '../../config/species.json';
import resourceConfig from '../../config/resource_balance.json';

/**
 * 🥚 SpawnerSystem
 * 월드 내의 자원 자동 생성, 수동 스폰 요청 처리, 특수 개체(벌 등)의 생태계 조립을 담당합니다.
 */
export default class SpawnerSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.terrainGen = engine.terrainGen;

        // 바이옴별 자동 생성 가능 리소스 정의 (확장성 확보)
        this.biomeSpawnTable = new Map([
            [BIOME_NAMES_TO_IDS.get('GRASS'), ['grass', 'flower', 'berry', 'oak', 'mushroom', 'medicinal_herb']],
            [BIOME_NAMES_TO_IDS.get('JUNGLE'), ['tropical_fruit_tree', 'mahogany', 'vine', 'shrub', 'wild_mushroom']],
            [BIOME_NAMES_TO_IDS.get('DESERT'), ['cactus', 'dry_brush', 'sand']],
            [BIOME_NAMES_TO_IDS.get('OCEAN'), ['seaweed', 'lotus', 'waterweed']],
            [BIOME_NAMES_TO_IDS.get('DEEP_OCEAN'), ['deep_sea_kelp']],
            [BIOME_NAMES_TO_IDS.get('RIVER'), ['reed', 'lotus', 'river_gravel']],
            [BIOME_NAMES_TO_IDS.get('SNOW'), ['snow_flower']]
        ]);

        this._initListeners();
    }

    _initListeners() {
        this.eventBus.on('SPAWN_POOP', (payload) => this.spawnPoop(payload.x, payload.y, payload.fertilityAmount));
        this.eventBus.on('SPAWN_ENTITY', (payload) => this.spawnEntity(payload));

        this.eventBus.on('APPLY_TOOL_EFFECT', (payload) => {
            const idx = this.terrainGen.getIndex(payload.x, payload.y);
            if (!this.terrainGen.isValidIndex(idx)) return;

            switch (payload.action) {
                case 'SPAWN_RESOURCE':
                    this.spawnGenericResource(payload.x, payload.y, payload.resourceId || 'grass', true);
                    break;
                case 'SPAWN_ENTITY':
                    this.spawnEntity(payload);
                    break;
                case 'CHANGE_BIOME':
                    this._applyBiomeChange(payload);
                    break;
            }
        });
    }

    _applyBiomeChange(payload) {
        const idx = this.terrainGen.getIndex(payload.x, payload.y);
        if (this.terrainGen.isValidIndex(idx)) {
            this.terrainGen.biomeBuffer[idx] = payload.biome;
            this.eventBus.emit('CACHE_PIXEL_UPDATE', { 
                x: Math.floor(payload.x), 
                y: Math.floor(payload.y), 
                reason: 'biome_change' 
            });
        }
    }

    update(dt, time) {
        // 성능을 위해 매 프레임 일정 횟수만큼만 자연 생성 시도
        this.autoSpawnResources();
    }

    /**
     * 🌿 자연적인 자원 증식 로직
     */
    autoSpawnResources() {
        const BATCH_SIZE = 15;
        for (let i = 0; i < BATCH_SIZE; i++) {
            const x = Math.floor(Math.random() * this.terrainGen.mapWidth);
            const y = Math.floor(Math.random() * this.terrainGen.mapHeight);
            const idx = this.terrainGen.getIndex(x, y);
            
            const biomeId = this.terrainGen.biomeBuffer[idx];
            const fertility = this.terrainGen.fertilityBuffer[idx] / 100;

            // 비옥도가 낮은 곳은 자라지 않음 (최소 20% 필요)
            if (fertility < 0.2) continue;

            const possibleResources = this.biomeSpawnTable.get(biomeId);
            if (!possibleResources || possibleResources.length === 0) continue;

            // 비옥도에 비례한 생성 확률 (최대 5%)
            if (Math.random() < fertility * 0.05) {
                const resourceId = possibleResources[Math.floor(Math.random() * possibleResources.length)];
                this.spawnGenericResource(x, y, resourceId, false);
            }
        }
    }

    /**
     * 📦 범용 자원 생성 (식물, 나무, 광물 등)
     */
    spawnGenericResource(x, y, resourceId, forceSpawn = false) {
        if (resourceId === 'plant') resourceId = 'grass';
        const config = resourceConfig[resourceId];
        if (!config) return null;

        const idx = this.terrainGen.getIndex(x, y);
        const isMineral = ['mineral', 'geological', 'material'].includes(config.type);
        const envValue = isMineral ? this.terrainGen.mineralDensityBuffer[idx] : this.terrainGen.fertilityBuffer[idx] / 100;

        // 환경 제약 조건 체크 (강제 스폰 도구가 아닐 때만)
        if (!forceSpawn) {
            const isAquatic = ['deep_sea_kelp', 'seaweed', 'lotus', 'waterweed', 'reed'].includes(resourceId);
            const isWater = this.terrainGen.isWater(idx);
            
            // 육상 생물은 물에서, 수상 생물은 육지에서 자라지 못함
            if (isWater !== isAquatic) return null;
            if (envValue < 0.1) return null; // 너무 척박하면 생성 불가
        }

        const category = isMineral ? 'resource' : 'nature';
        const entityId = this.engine.factoryProvider.spawn(category, resourceId, x, y, { 
            quality: forceSpawn ? 0.8 : envValue 
        });

        if (entityId) {
            this._handleSpecialResourceSpawn(resourceId, x, y, entityId);
        }

        return entityId;
    }

    /** 특수 자원 생성 시 부가 로직 (벌집 등) */
    _handleSpecialResourceSpawn(resourceId, x, y, entityId) {
        if (resourceId.includes('beehive')) {
            this.spawnBee(x, y, 'queen', entityId);
            for(let i=0; i<3; i++) this.spawnBee(x, y, 'worker', entityId);
        }
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

    /**
     * 🦁 생명체 및 유기물 스폰 처리
     */
    spawnEntity(payload) {
        const type = payload.type || this._deriveTypeFromMethod(payload.method);
        if (!type) return null;

        // 카테고리 결정 로직 고도화
        const category = this._determineCategory(type);
        
        const newId = this.engine.factoryProvider.spawn(category, type, payload.x, payload.y, { 
            isBaby: payload.isBaby || false,
            quality: payload.quality || 1.0 
        });

        // 🍖 [Predation Link] 사냥 직후 보상 생성 시 타겟 자동 지정
        if (newId && payload.killerId) {
            const killer = this.entityManager.entities.get(payload.killerId);
            const state = killer?.components.get('AIState');
            if (state) {
                state.targetId = newId;
                state.failedPathCount = 0;
            }
        }

        return newId;
    }

    _deriveTypeFromMethod(method) {
        if (!method) return null;
        let type = method.replace('spawn', '').toLowerCase();
        if (type === 'wilddog') return 'wild_dog';
        return type;
    }

    _determineCategory(type) {
        const resourceTypes = ['meat', 'poop', 'wood', 'stone', 'food', 'gold', 'leather', 'bone', 'iron', 'silver', 'copper'];
        if (resourceTypes.includes(type)) return 'resource';
        if (type === 'human') return 'human';
        return 'animal';
    }

    spawnPoop(x, y, fertilityAmount = 1.0) {
        this.engine.factoryProvider.spawn('resource', 'poop', x, y, { quality: fertilityAmount });
    }
}