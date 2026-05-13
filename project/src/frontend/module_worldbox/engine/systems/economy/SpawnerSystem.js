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
            [BIOME_NAMES_TO_IDS.get('GRASS'), ['grass', 'flower', 'berry', 'tree_oak', 'mushroom', 'medicinal_herb']],
            [BIOME_NAMES_TO_IDS.get('JUNGLE'), ['tree_tropical_fruit', 'tree_mahogany', 'vine', 'shrub', 'wild_mushroom']],
            [BIOME_NAMES_TO_IDS.get('DESERT'), ['cactus', 'dry_brush', 'sand']],
            [BIOME_NAMES_TO_IDS.get('OCEAN'), ['seaweed', 'lotus', 'waterweed']],
            [BIOME_NAMES_TO_IDS.get('DEEP_OCEAN'), ['deep_sea_kelp']],
            [BIOME_NAMES_TO_IDS.get('RIVER'), ['reed', 'lotus', 'river_gravel']],
            [BIOME_NAMES_TO_IDS.get('SNOW'), ['snow_flower']]
        ]);

        this._initListeners();

        // 🚀 [Expert Optimization] 초기화 시점에는 크기를 0으로 설정 (WORLD_READY 시점에 동적 할당)
        this.treeOccupancyBuffer = new Uint8Array(0);
        this.treeOccupancyGridW = 0;
        this.treeOccupancyGridH = 0;

        // 🚀 지형 생성이 완전히 완료된 후 초기 세계 생성 실행
        this.eventBus.on('WORLD_READY', () => {
            this.initializeWorld();
        });
    }

    /**
     * 🌍 초기 세계 생성 로직
     * 사용자 설정(options)에 따라 나무, 자원, 동물을 대량으로 스폰합니다.
     */
    initializeWorld() {
        const options = this.engine.options || {};
        const natureMult = (options.natureDensity ?? 0) / 100;
        const mineralMult = (options.mineralDensity ?? 0) / 100;
        const animalMult = (options.animalDensity ?? 0) / 100;
        const humanCount = options.humanCount ?? 0;

        console.log(`🌌 INITIALIZING WORLD WITH: Nature ${natureMult}x, Mineral ${mineralMult}x, Animal ${animalMult}x, Humans ${humanCount}`);

        const w = this.terrainGen.mapWidth;
        const h = this.terrainGen.mapHeight;

        // 🚀 [Expert Optimization] 나무 점유 맵 (Occupancy Map) 동적 초기화 (맵 크기 확정 시점)
        const gridW = Math.ceil(w / 16);
        const gridH = Math.ceil(h / 16);
        this.treeOccupancyBuffer = new Uint8Array(gridW * gridH);
        this.treeOccupancyGridW = gridW;
        this.treeOccupancyGridH = gridH;

        // 1. 🌿 식물 및 나무 스폰 (비옥도 기반)
        const natureTarget = Math.floor((w * h / 500) * natureMult);
        for (let i = 0; i < natureTarget; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const idx = this.terrainGen.getIndex(x, y);
            if (idx === -1) continue;

            const fertility = this.terrainGen.fertilityBuffer[idx] / 100;

            if (fertility > 0.3 && !this.terrainGen.isWater(idx)) {
                const biomeId = this.terrainGen.biomeBuffer[idx];
                const pool = this.biomeSpawnTable.get(biomeId) || ['grass'];
                const resId = pool[Math.floor(Math.random() * pool.length)];
                this.spawnGenericResource(x, y, resId, false, true); // 🚀 5번째 인자 true: 초기화 중
            }
        }

        // 2. 💎 광석 스폰 (밀도 기반)
        const mineralTarget = Math.floor((w * h / 2000) * mineralMult);
        const minerals = ['stone', 'iron', 'gold', 'coal'];
        for (let i = 0; i < mineralTarget; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const idx = this.terrainGen.getIndex(x, y);
            if (this.terrainGen.mineralDensityBuffer[idx] > 100 && !this.terrainGen.isWater(idx)) {
                const resId = minerals[Math.floor(Math.random() * minerals.length)];
                this.spawnGenericResource(x, y, resId, false);
            }
        }

        // 3. 🐑 동물 스폰
        const animalTarget = Math.floor(50 * animalMult);
        const animals = ['sheep', 'rabbit', 'wild_dog', 'wolf'];
        for (let i = 0; i < animalTarget; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const idx = this.terrainGen.getIndex(x, y);
            if (!this.terrainGen.isWater(idx)) {
                const type = animals[Math.floor(Math.random() * animals.length)];
                this.spawnEntity({ type, x, y });
            }
        }

        // 4. 🧍 인간 개척민 스폰 (맵 중앙 근처)
        for (let i = 0; i < humanCount; i++) {
            const x = (w * 0.4) + (Math.random() * w * 0.2);
            const y = (h * 0.4) + (Math.random() * h * 0.2);
            const idx = this.terrainGen.getIndex(x, y);
            if (!this.terrainGen.isWater(idx)) {
                this.spawnEntity({ type: 'human', x, y });
            }
        }

        // 🚀 [Expert Optimization] 모든 스폰이 끝난 후 한 번에 청크 갱신 트리거
        if (this.engine.chunkManager) {
            this.engine.chunkManager.markAllDirty();
        }

        GlobalLogger.success(`World generation complete: ${natureTarget} nature nodes, ${humanCount} humans initialized.`);
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
        // 성능을 위해 매 프레임 일정 횟수만큼만 자연 생성 시도
        this.autoSpawnResources();
    }

    /**
     * 🌿 자연적인 자원 증식 로직
     */
    autoSpawnResources() {
        // 🚀 [Stability Fix] 배치 사이즈를 15로 고정하여 급격한 부하 방지
        const BATCH_SIZE = 15;

        for (let i = 0; i < BATCH_SIZE; i++) {
            const x = Math.floor(Math.random() * this.terrainGen.mapWidth);
            const y = Math.floor(Math.random() * this.terrainGen.mapHeight);
            const idx = this.terrainGen.getIndex(x, y);
            if (idx === -1) continue;

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
    spawnGenericResource(x, y, resourceId, forceSpawn = false, isInitializing = false) {
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

        // 🚀 [Expert Optimization] 나무 점유 맵을 활용한 O(1) 밀도 체크 (프리징 근본 해결)
        const gx = Math.floor(x / 16);
        const gy = Math.floor(y / 16);

        if (config.type === 'tree') {
            if (!forceSpawn && !isInitializing) {
                // 🚀 [Expert Optimization] 버퍼가 유효할 때만 밀도 체크 수행
                if (this.treeOccupancyBuffer.length > 0) {
                    for (let oy = -1; oy <= 1; oy++) {
                    const cy = gy + oy;
                    if (cy < 0 || cy >= this.treeOccupancyGridH) continue;

                    const rowOffset = cy * this.treeOccupancyGridW;
                    for (let ox = -1; ox <= 1; ox++) {
                        const cx = gx + ox;
                        if (cx < 0 || cx >= this.treeOccupancyGridW) continue;

                        if (this.treeOccupancyBuffer[rowOffset + cx] === 1) return null;
                    }
                }
            }
        }
    }

        // 🛡️ [Stability] 좌표 유효성 검사 (도구 사용 시 NaN 방지)
        if (isNaN(x) || isNaN(y)) return null;

        const entityId = this.engine.factoryProvider.spawn(category, resourceId, x, y, {
            quality: forceSpawn ? 0.8 : envValue,
            skipDirty: isInitializing // 🚀 초기화 중에는 청크 갱신 생략
        });

        if (entityId) {
            if (config.type === 'tree' && this.treeOccupancyBuffer.length > 0 && 
                gx >= 0 && gx < this.treeOccupancyGridW && gy >= 0 && gy < this.treeOccupancyGridH) {
                this.treeOccupancyBuffer[gy * this.treeOccupancyGridW + gx] = 1;
            }
            this._handleSpecialResourceSpawn(resourceId, x, y, entityId);
        }

        return entityId;
    }

    /** 🚀 [Expert Interface] 나무 제거 시 점유 맵 동기화 */
    clearTreeOccupancy(x, y) {
        const gx = Math.floor(x / 16);
        const gy = Math.floor(y / 16);
        
        // 🚀 [Expert Fix] 인덱스 경계 이탈 방지
        if (gx >= 0 && gx < this.treeOccupancyGridW && gy >= 0 && gy < this.treeOccupancyGridH) {
            const gIdx = gy * this.treeOccupancyGridW + gx;
            if (gIdx >= 0 && gIdx < this.treeOccupancyBuffer.length) {
                this.treeOccupancyBuffer[gIdx] = 0;
            }
        }
    }

    /** 특수 자원 생성 시 부가 로직 (벌집 등) */
    _handleSpecialResourceSpawn(resourceId, x, y, entityId) {
        if (resourceId.includes('beehive')) {
            this.spawnBee(x, y, 'queen', entityId);
            for (let i = 0; i < 3; i++) this.spawnBee(x, y, 'worker', entityId);
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

        if (newId) {
            this.eventBus.emit('ENTITY_SPAWNED', { id: newId, type, category, x: payload.x, y: payload.y });
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
        const itemTypes = ['meat', 'poop', 'wood', 'stone', 'food', 'gold', 'leather', 'bone', 'iron', 'silver', 'copper'];
        if (itemTypes.includes(type)) return 'item'; // 📦 수집 가능한 '아이템' 카테고리
        if (type === 'human') return 'human';
        return 'animal';
    }

    spawnPoop(x, y, fertilityAmount = 1.0) {
        this.engine.factoryProvider.spawn('item', 'poop', x, y, { quality: fertilityAmount });
    }
}