import { BIOME_NAMES_TO_IDS } from '../../world/TerrainGen.js';
import System from '../../core/System.js';
import WorldInitializer from './spawner_modules/WorldInitializer.js';
import DynamicSpawner from './spawner_modules/DynamicSpawner.js';
import EcosystemAssembler from './spawner_modules/EcosystemAssembler.js';

/**
 * 🥚 SpawnerSystem (Facade)
 * 월드 내의 자원 자동 생성 및 생태계 조립을 조율하는 시스템입니다.
 * 리팩토링을 통해 초기화, 동적 생성, 조립 로직을 각각의 모듈로 분리하였습니다.
 */
export default class SpawnerSystem extends System {
    constructor(entityManager, eventBus, engine) {
        super(entityManager, eventBus);
        this.engine = engine;
        this.terrainGen = engine.terrainGen;

        // 🚀 [Expert Optimization] 나무 점유 맵 (Occupancy Map)
        this.treeOccupancyBuffer = new Uint8Array(0);
        this.treeOccupancyGridW = 0;
        this.treeOccupancyGridH = 0;

        // 바이옴별 자동 생성 가능 리소스 정의
        this.biomeSpawnTable = new Map([
            [BIOME_NAMES_TO_IDS.get('GRASS'), ['grass', 'flower', 'berry', 'tree_oak', 'mushroom', 'medicinal_herb']],
            [BIOME_NAMES_TO_IDS.get('JUNGLE'), ['tree_tropical_fruit', 'tree_mahogany', 'vine', 'shrub', 'wild_mushroom']],
            [BIOME_NAMES_TO_IDS.get('DESERT'), ['cactus', 'dry_brush', 'sand']],
            [BIOME_NAMES_TO_IDS.get('OCEAN'), ['seaweed', 'lotus', 'waterweed']],
            [BIOME_NAMES_TO_IDS.get('DEEP_OCEAN'), ['deep_sea_kelp']],
            [BIOME_NAMES_TO_IDS.get('RIVER'), ['reed', 'lotus', 'river_gravel']],
            [BIOME_NAMES_TO_IDS.get('SNOW'), ['snow_flower']]
        ]);

        // 🚀 서브 시스템 초기화 (의존성 주입)
        this.assembler = new EcosystemAssembler(this);
        this.initializer = new WorldInitializer(this);
        this.dynamicSpawner = new DynamicSpawner(this);

        this._initListeners();

        this.eventBus.on('WORLD_READY', () => {
            this.initializer.initializeWorld();
        });
    }

    _initListeners() {
        this.eventBus.on('SPAWN_POOP', (payload) => this.dynamicSpawner.spawnPoop(payload.x, payload.y, payload.fertilityAmount));
        this.eventBus.on('SPAWN_ENTITY', (payload) => this.assembler.spawnEntity(payload));

        this.eventBus.on('APPLY_TOOL_EFFECT', (payload) => {
            const idx = this.terrainGen.getIndex(payload.x, payload.y);
            if (!this.terrainGen.isValidIndex(idx)) return;

            switch (payload.action) {
                case 'SPAWN_RESOURCE':
                    this.assembler.spawnGenericResource(payload.x, payload.y, payload.resourceId || 'grass', true);
                    break;
                case 'SPAWN_ENTITY':
                    this.assembler.spawnEntity(payload);
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
            this.terrainGen.safeAtomicsStore(this.terrainGen.biomeBuffer, idx, payload.biome);
            this.terrainGen.syncPackedPixel(idx);
            this.eventBus.emitDeferred('CACHE_PIXEL_UPDATE', {
                x: Math.floor(payload.x),
                y: Math.floor(payload.y),
                reason: 'biome_change'
            });
        }
    }

    update(dt, time) {
        this.dynamicSpawner.autoSpawnResources();
    }

    // --- External Delegates (Maintaining compatibility) ---
    spawnGenericResource(...args) { return this.assembler.spawnGenericResource(...args); }
    spawnEntity(...args) { return this.assembler.spawnEntity(...args); }
    spawnBee(...args) { return this.assembler.spawnBee(...args); }
    spawnPoop(...args) { return this.dynamicSpawner.spawnPoop(...args); }

    /** 🚀 [Expert Interface] 나무 제거 시 점유 맵 동기화 */
    clearTreeOccupancy(x, y) {
        const gx = Math.floor(x / 16);
        const gy = Math.floor(y / 16);
        if (gx >= 0 && gx < this.treeOccupancyGridW && gy >= 0 && gy < this.treeOccupancyGridH) {
            const gIdx = gy * this.treeOccupancyGridW + gx;
            if (gIdx >= 0 && gIdx < this.treeOccupancyBuffer.length) {
                this.treeOccupancyBuffer[gIdx] = 0;
            }
        }
    }
}